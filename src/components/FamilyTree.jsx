import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow, Controls, Background, addEdge,
  applyNodeChanges, applyEdgeChanges,
  Handle, Position, Panel, useReactFlow, ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToTree, saveTree } from '../firebase/db';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/imageUtils';
import { Download, Plus, X, Trash2, GitMerge, Shuffle } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { v4 as uuidv4 } from 'uuid';
import dagre from 'dagre';

// ─── Dimensions ───────────────────────────────────────────────────────────────
const CARD_W    = 160;
const CARD_H    = 190;
const HEART_W   = 44;
const HEART_H   = 44;
const JUNC_R    = 7;   // junction dot radius

// ─── Relationship classifiers ─────────────────────────────────────────────────
const PARENT_LABELS  = ['father', 'mother', 'parent', 'grandfather', 'grandmother', 'grandparent', 'uncle', 'aunt'];
const CHILD_LABELS   = ['son', 'daughter', 'child', 'grandson', 'granddaughter', 'nephew', 'niece'];
const SPOUSE_LABELS  = ['wife', 'husband', 'spouse', 'partner'];
const SIBLING_LABELS = ['brother', 'sister', 'sibling'];

const classify = (rel = '') => {
  const r = rel.toLowerCase();
  if (PARENT_LABELS.some(l  => r.includes(l))) return 'parent';
  if (CHILD_LABELS.some(l   => r.includes(l))) return 'child';
  if (SPOUSE_LABELS.some(l  => r.includes(l))) return 'spouse';
  if (SIBLING_LABELS.some(l => r.includes(l))) return 'sibling';
  return 'other';
};

// ─── Edge factories ───────────────────────────────────────────────────────────
const mkStep = (src, srcH, tgt, tgtH) => ({
  id: uuidv4(), source: src, sourceHandle: srcH,
  target: tgt, targetHandle: tgtH,
  type: 'step', animated: false,
  style: { stroke: '#3a86ff', strokeWidth: 2.5 },
});

const mkStraight = (src, srcH, tgt, tgtH, color = '#ff006e') => ({
  id: uuidv4(), source: src, sourceHandle: srcH,
  target: tgt, targetHandle: tgtH,
  type: 'straight', animated: false,
  style: { stroke: color, strokeWidth: 2 },
});

// ─── Step 1: build tree edges + junction nodes (without marriage nodes) ───────
/*
  Structure produced:
    Father (bottom) ──step──╮
                         [junction] ──step──► Son1
    Mother (bottom) ──step──╯          ──step──► Son2

  The two step edges from Father and Mother create a natural ┘└ T-bar.
*/
const buildTreeGraph = (personNodes) => {
  const parents  = personNodes.filter(n => classify(n.data.relationship) === 'parent');
  const children = personNodes.filter(n => classify(n.data.relationship) === 'child');
  const selfNode = personNodes.find(n =>
    ['me', 'self', 'root', 'i'].includes((n.data.relationship || '').toLowerCase())
  );

  const junctions = [];
  const edges     = [];

  const addFamily = (parentNodes, childNodes, juncId) => {
    if (!parentNodes.length || !childNodes.length) return;
    junctions.push({
      id: juncId, type: 'junctionNode',
      position: { x: 0, y: 0 },
      data: {}, selectable: false, deletable: false,
    });
    parentNodes.forEach(p => edges.push(mkStep(p.id, 'bottom', juncId,  'top')));
    childNodes.forEach(c  => edges.push(mkStep(juncId, 'bottom', c.id,  'top')));
  };

  if (parents.length > 0) {
    addFamily(parents, children, 'junction-main');
  } else if (selfNode) {
    addFamily([selfNode], children, 'junction-self');
  }

  return { junctions, edges };
};

// ─── Step 2: dagre positions person + junction nodes ─────────────────────────
const runDagre = (nodes, edges) => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 110, nodesep: 90 });

  nodes.forEach(n => {
    if (n.type === 'junctionNode') g.setNode(n.id, { width: JUNC_R * 2, height: JUNC_R * 2 });
    else                           g.setNode(n.id, { width: CARD_W,      height: CARD_H      });
  });
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodes.map(n => {
    const p = g.node(n.id);
    if (!p) return n;
    if (n.type === 'junctionNode')
      return { ...n, position: { x: p.x - JUNC_R,      y: p.y - JUNC_R      } };
    return   { ...n, position: { x: p.x - CARD_W / 2,  y: p.y - CARD_H / 2  } };
  });
};

// ─── Step 3: insert marriage heart between each couple ────────────────────────
/*
  Finds pairs of parents at the same generation (same rank / similar Y).
  Inserts a heart node between them and straight horizontal pink edges.
  This is purely visual – marriage nodes aren't in dagre.
*/
const insertMarriageNodes = (layoutedNodes, layoutedEdges) => {
  const parents = layoutedNodes
    .filter(n => n.type === 'personNode' && classify(n.data.relationship) === 'parent')
    .sort((a, b) => a.position.x - b.position.x);

  if (parents.length < 2) return { nodes: layoutedNodes, edges: layoutedEdges };

  const extraNodes = [];
  const extraEdges = [];

  // Group parents that are at roughly the same Y (same generation)
  // Simple approach: group the leftmost & rightmost together per junction
  const left  = parents[0];
  const right  = parents[parents.length - 1];

  // Marriage heart: horizontally centred between the two parents, vertically centred on card
  const lRight  = left.position.x  + CARD_W;         // right edge of left parent
  const rLeft   = right.position.x;                   // left edge of right parent
  const hx = (lRight + rLeft) / 2  - HEART_W / 2;
  const hy = left.position.y       + CARD_H  / 2 - HEART_H / 2;

  const mid = 'marriage-main';
  extraNodes.push({
    id: mid, type: 'marriageNode',
    position: { x: hx, y: hy },
    data: {}, selectable: false, deletable: false, zIndex: 10,
  });

  // Straight horizontal edges: left parent right-side → heart, right parent left-side → heart
  extraEdges.push(mkStraight(left.id,  'couple-r', mid, 'left'));
  extraEdges.push(mkStraight(right.id, 'couple-l', mid, 'right'));

  return {
    nodes: [...layoutedNodes, ...extraNodes],
    edges: [...layoutedEdges, ...extraEdges],
  };
};

// ─── Full layout pipeline ─────────────────────────────────────────────────────
const fullLayout = (personNodes) => {
  const { junctions, edges: treeEdges } = buildTreeGraph(personNodes);
  const positioned = runDagre([...personNodes, ...junctions], treeEdges);
  return insertMarriageNodes(positioned, treeEdges);
};

// ─── Node components ──────────────────────────────────────────────────────────
const invisible = { background: 'transparent', border: 'none', width: 4, height: 4, opacity: 0, pointerEvents: 'none' };
const cyan      = { background: '#00f3ff', width: 10, height: 10, border: '2px solid #00f3ff' };

const PersonNode = ({ data, selected }) => (
  <div style={{
    background: 'rgba(16,24,39,0.9)', backdropFilter: 'blur(8px)',
    border: `2px solid ${selected ? '#00f3ff' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 16, padding: 16, width: CARD_W,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: selected ? '0 0 24px rgba(0,243,255,0.5)' : '0 8px 32px rgba(0,0,0,0.4)',
    color: '#fff', transition: 'all 0.2s',
  }}>
    {/* Tree connection handles (visible) */}
    <Handle type="target" position={Position.Top}    id="top"      style={cyan} />
    <Handle type="source" position={Position.Bottom} id="bottom"   style={cyan} />
    {/* Couple connection handles (invisible – used only by code) */}
    <Handle type="source" position={Position.Right}  id="couple-r" style={{ ...invisible, top: '50%' }} />
    <Handle type="source" position={Position.Left}   id="couple-l" style={{ ...invisible, top: '50%' }} />

    {data.photo
      ? <img src={data.photo} alt={data.name}
          style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', marginBottom: 10, border: '2px solid #8338ec' }} />
      : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#162135', border: '2px solid #8338ec',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, fontSize: '1.3rem', fontWeight: 700 }}>
          {data.name?.charAt(0)}
        </div>
    }
    <div style={{ fontWeight: 600, fontSize: '1rem', textAlign: 'center',
      background: 'linear-gradient(90deg,#00f3ff,#8338ec)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
      {data.name}
    </div>
    <div style={{ fontSize: '0.8rem', color: '#adb5bd', marginTop: 3, textAlign: 'center' }}>
      {data.relationship}
    </div>
  </div>
);

// Heart symbol between couple
const MarriageNode = () => (
  <div style={{
    width: HEART_W, height: HEART_H,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.5rem', lineHeight: 1, cursor: 'default',
    filter: 'drop-shadow(0 0 8px rgba(255,0,110,0.9))',
    userSelect: 'none',
  }}>
    <Handle type="target" position={Position.Left}  id="left"  style={{ ...invisible, left: -2  }} />
    <Handle type="target" position={Position.Right} id="right" style={{ ...invisible, right: -2 }} />
    ♥
  </div>
);

// Junction dot – where step edges from parents meet, and fan out to children
const JunctionNode = () => (
  <div style={{
    width: JUNC_R * 2, height: JUNC_R * 2,
    borderRadius: '50%', background: '#3a86ff',
    boxShadow: '0 0 10px rgba(58,134,255,0.9)',
    border: '2px solid #3a86ff',
  }}>
    <Handle type="target" position={Position.Top}    id="top"    style={{ ...cyan, top:    -4 }} />
    <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...cyan, bottom: -4 }} />
  </div>
);

const nodeTypes = { personNode: PersonNode, marriageNode: MarriageNode, junctionNode: JunctionNode };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SPECIAL = new Set(['junctionNode', 'marriageNode', 'unionNode']);
const toPersonNodes = (nodes) => nodes.filter(n => !SPECIAL.has(n.type));

// Edge for manual "connect to" in the add form
const buildAddEdge = (newId, toId, rel, edges, nodes) => {
  const kind = classify(rel);
  // Find existing junction that toId sources into
  const juncEdge = edges.find(e => e.source === toId && nodes.find(n => n.id === e.target && n.type === 'junctionNode'));

  if (kind === 'parent')  return [mkStep(newId, 'bottom', toId, 'top')];
  if (kind === 'child')   return juncEdge
                                  ? [mkStep(juncEdge.target, 'bottom', newId, 'top')]
                                  : [mkStep(toId, 'bottom', newId, 'top')];
  if (kind === 'spouse')  return [mkStraight(toId, 'couple-r', newId, 'couple-l', '#ff006e')];
  if (kind === 'sibling') {
    const above = edges.find(e => e.target === toId && e.type === 'step');
    return above ? [mkStep(above.source, 'bottom', newId, 'top')] : [mkStep(toId, 'bottom', newId, 'top')];
  }
  return [mkStep(toId, 'bottom', newId, 'top')];
};

// ─── Tree logic component ─────────────────────────────────────────────────────
function TreeLogic() {
  const { userProfile, currentUser, canEdit, isLocked } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const { fitView } = useReactFlow();
  const wrapper = useRef(null);

  // Subscribe to Firestore tree – rebuild layout whenever data changes
  useEffect(() => {
    if (!userProfile?.familyId) return;
    return subscribeToTree(userProfile.familyId, (data) => {
      const persons = toPersonNodes(data.personNodes || []);
      const { nodes: n, edges: e } = fullLayout(persons);
      setNodes(n); setEdges(e);
    });
  }, [userProfile?.familyId]);

  const persist = (n) =>
    saveTree(userProfile.familyId, toPersonNodes(n), currentUser.uid, userProfile.username);

  const onNodesChange = useCallback(changes => setNodes(nds => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback(changes => setEdges(eds => applyEdgeChanges(changes, eds)), []);
  const onConnect     = useCallback(params  => setEdges(eds => addEdge(
    { ...params, type: 'step', animated: false, style: { stroke: '#3a86ff', strokeWidth: 2 } }, eds
  )), []);
  const onSelectionChange = useCallback(({ nodes: sel }) => setSelectedNodes(sel), []);

  // Add member
  const handleAdd = async ({ connectToId, photo: rawPhoto, ...nodeData }) => {
    const photo  = rawPhoto ? await compressImage(rawPhoto) : null;
    const newId   = uuidv4();
    const newNode = { id: newId, type: 'personNode', position: { x: 0, y: 0 }, data: { ...nodeData, photo } };
    const persons = [...toPersonNodes(nodes), newNode];
    const { nodes: n, edges: e } = fullLayout(persons);
    setNodes(n); setEdges(e);
    persist(n);
    setIsAddOpen(false);
    setTimeout(() => window.requestAnimationFrame(() => fitView()), 80);
  };

  // Delete selected person nodes
  const handleDelete = () => {
    const ids = new Set(selectedNodes.map(n => n.id));
    const persons = toPersonNodes(nodes).filter(n => !ids.has(n.id));
    const { nodes: n, edges: e } = fullLayout(persons);
    setNodes(n); setEdges(e);
    persist(n);
    setSelectedNodes([]);
  };

  // Re-run full layout
  const handleAutoConnect = () => {
    const persons = toPersonNodes(nodes);
    const { nodes: n, edges: e } = fullLayout(persons);
    setNodes([...n]); setEdges([...e]);
    persist(n);
    window.requestAnimationFrame(() => fitView());
  };

  // Download
  const handleDownload = async () => {
    if (!wrapper.current) return;
    try {
      document.querySelectorAll('.react-flow__controls,.react-flow__panel').forEach(el => el.style.visibility = 'hidden');
      const blob = await toBlob(wrapper.current, { backgroundColor: '#0a0f1a', pixelRatio: 2 });
      document.querySelectorAll('.react-flow__controls,.react-flow__panel').forEach(el => el.style.visibility = 'visible');
      if (!blob) { alert('Could not generate image.'); return; }
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: `birthtree-family-${Date.now()}.png` })
        .click();
      setTimeout(() => URL.revokeObjectURL(url), 200);
    } catch (err) { alert('Download error: ' + err.message); }
  };

  const personNodes = toPersonNodes(nodes);

  return (
    <>
      <div ref={wrapper} style={{ height: '100%', width: '100%' }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes} fitView
          deleteKeyCode={['Backspace', 'Delete']}
          nodesDraggable={true}
          elementsSelectable={true}
        >
          <Background color="#ffffff" gap={24} size={1} opacity={0.05} />
          <Controls style={{ background: 'rgba(16,24,39,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }} />
          <Panel position="top-right" style={{ display: 'flex', gap: 10, margin: 20, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            {isLocked && !canEdit && (
              <span style={{ fontSize: '0.78rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '4px 10px' }}>
                🔒 Locked
              </span>
            )}
            {canEdit && selectedNodes.filter(n => !SPECIAL.has(n.type)).length > 0 && (
              <button className="btn-outline" onClick={handleDelete} style={{ borderColor: '#ff4d4d', color: '#ff4d4d', background: 'rgba(255,77,77,0.1)' }}>
                <Trash2 size={16} /> Delete
              </button>
            )}
            {canEdit && (
              <button className="btn-outline" onClick={handleAutoConnect} style={{ background: 'rgba(16,24,39,0.85)' }}>
                <Shuffle size={16} /> Rebuild Tree
              </button>
            )}
            <button className="btn-outline" onClick={handleDownload} style={{ background: 'rgba(16,24,39,0.85)' }}>
              <Download size={16} /> Download
            </button>
            {canEdit && (
              <button className="btn-primary" onClick={() => setIsAddOpen(true)}>
                <Plus size={16} /> Add Member
              </button>
            )}
          </Panel>
        </ReactFlow>
      </div>

      <AnimatePresence>
        {isAddOpen && (
          <AddMemberModal
            existingNodes={personNodes}
            onClose={() => setIsAddOpen(false)}
            onAdded={handleAdd}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default function FamilyTreeView() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ height: 'calc(100vh - 80px)', width: '100%' }}>
      <ReactFlowProvider><TreeLogic /></ReactFlowProvider>
    </motion.div>
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────
function AddMemberModal({ existingNodes, onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', relationship: '', photo: null, connectToId: '' });

  const handlePhoto = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, photo: reader.result }));
    reader.readAsDataURL(file);
  };

  const kind = classify(form.relationship);
  const hints = {
    parent:  '→ placed above, connected down to selected person',
    child:   '→ placed below the selected person',
    spouse:  '→ same level, connected with a heart ♥',
    sibling: '→ shares the same parent(s) as selected person',
    other:   '→ connected as a relative below',
  };

  return (
    <div className="modal-overlay">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="glass-panel modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ color: 'var(--accent-cyan)' }}>Add Family Member</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (form.name && form.relationship) onAdded(form); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)' }}>Name *</label>
            <input required type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)' }}>Relationship *</label>
            <input required type="text" value={form.relationship}
              onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}
              placeholder="Father · Mother · Son · Wife · Brother …" />
            {form.relationship && (
              <p style={{ margin: '5px 0 0', fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
                {hints[kind] || hints.other}
              </p>
            )}
          </div>
          {existingNodes.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)' }}>
                Whose {form.relationship || 'relative'}?
              </label>
              <select value={form.connectToId} onChange={e => setForm(f => ({ ...f, connectToId: e.target.value }))}>
                <option value="">— select a person —</option>
                {existingNodes.map(n => (
                  <option key={n.id} value={n.id}>{n.data.name} ({n.data.relationship})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)' }}>Photo</label>
            <input type="file" accept="image/*" onChange={handlePhoto} />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: 8, justifyContent: 'center' }}>
            Add to Tree
          </button>
        </form>
      </motion.div>
    </div>
  );
}
