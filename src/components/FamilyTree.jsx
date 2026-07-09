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

// ─── Relationship graph ───────────────────────────────────────────────────────
// Every person carries structured relations in data:
//   data.parents  : [personId, personId]  — who their parents are
//   data.spouseId : personId | null       — who they are married to
// The layout is derived purely from this graph, so one person can be
// related to many others and everything reconnects automatically.

const clonePersons = (nodes) => nodes.map(n => ({
  ...n,
  data: { ...n.data, parents: [...(n.data.parents || [])], spouseId: n.data.spouseId ?? null },
}));

const isSelf = (n) =>
  ['me', 'self', 'root', 'i'].includes((n.data.relationship || '').toLowerCase());

// Legacy trees only stored relationship labels. Derive a structure once so
// existing data (e.g. Father + Wife + Me + Son) forms the expected family.
const normalize = (raw) => {
  const persons = clonePersons(raw);
  const hasStructure = persons.some(n => n.data.parents.length || n.data.spouseId);
  if (hasStructure || persons.length < 2) return persons;

  const kind = n => classify(n.data.relationship);
  const self     = persons.find(isSelf);
  const parents  = persons.filter(n => kind(n) === 'parent');
  const spouses  = persons.filter(n => kind(n) === 'spouse');
  const children = persons.filter(n => kind(n) === 'child');
  const siblings = persons.filter(n => kind(n) === 'sibling');
  const marry = (a, b) => { if (a && b) { a.data.spouseId = b.id; b.data.spouseId = a.id; } };

  if (parents.length >= 2)                     marry(parents[0], parents[1]);
  else if (parents.length === 1 && spouses[0]) marry(parents[0], spouses[0]);
  else if (self && spouses[0])                 marry(self, spouses[0]);

  if (parents.length) {
    const couple = [parents[0].id, parents[0].data.spouseId].filter(Boolean);
    [...(self ? [self] : []), ...children, ...siblings].forEach(c => { c.data.parents = couple; });
  } else if (self) {
    const couple = [self.id, self.data.spouseId].filter(Boolean);
    children.forEach(c => { c.data.parents = couple; });
  }
  return persons;
};

// Build junction dots + step edges from the relation graph.
// Children with the same parent set share one junction:
//   ParentA ─╮
//        [junction] ─► Child1, Child2 …
//   ParentB ─╯
const buildGraph = (persons) => {
  const ids = new Set(persons.map(n => n.id));
  const junctions = [];
  const edges = [];
  const families = new Map();

  persons.forEach(p => {
    const ps = p.data.parents.filter(id => ids.has(id));
    if (!ps.length) return;
    const key = [...ps].sort().join('+');
    if (!families.has(key)) families.set(key, { parents: ps, children: [] });
    families.get(key).children.push(p.id);
  });

  let i = 0;
  families.forEach(fam => {
    const jid = `junction-${i++}`;
    junctions.push({
      id: jid, type: 'junctionNode', position: { x: 0, y: 0 },
      data: {}, selectable: false, deletable: false,
    });
    fam.parents.forEach(pid  => edges.push(mkStep(pid, 'bottom', jid, 'top')));
    fam.children.forEach(cid => edges.push(mkStep(jid, 'bottom', cid, 'top')));
  });
  return { junctions, edges };
};

// Dagre ranks the graph top-down; spouses are pinned to the same rank.
const runDagre = (nodes, edges, persons) => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 110, nodesep: 70 });

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
      return { ...n, position: { x: p.x - JUNC_R,     y: p.y - JUNC_R     } };
    return   { ...n, position: { x: p.x - CARD_W / 2, y: p.y - CARD_H / 2 } };
  });
};

// Insert a heart + pink lines between every married couple (purely visual).
const insertMarriages = (layoutedNodes, layoutedEdges, persons) => {
  const nodes = [...layoutedNodes];
  const edges = [...layoutedEdges];
  const seen = new Set();

  persons.forEach(p => {
    const sid = p.data.spouseId;
    if (!sid || seen.has(p.id) || seen.has(sid)) return;
    const a = nodes.find(n => n.id === p.id);
    const b = nodes.find(n => n.id === sid);
    if (!a || !b) return;
    seen.add(p.id); seen.add(sid);

    // Snap the couple onto one row, directly side by side.
    // Anchor on the partner that hangs from a junction (has parents);
    // the free-floating spouse moves next to them.
    const hasParents = n => (persons.find(x => x.id === n.id)?.data.parents || []).length > 0;
    let anchor = a, other = b;
    if (!hasParents(a) && hasParents(b))      { anchor = b; other = a; }
    else if (hasParents(a) === hasParents(b) && b.position.y > a.position.y) { anchor = b; other = a; }
    other.position = { ...other.position, y: anchor.position.y };

    const GAP = 90;
    const dist = Math.abs(anchor.position.x - other.position.x);
    if (dist < CARD_W + 40 || dist > CARD_W + GAP + 10) {
      const desiredX = anchor.position.x + CARD_W + GAP;
      // if someone else is already in that slot, swap them into the spouse's old spot
      const occupant = nodes.find(n => n !== anchor && n !== other && n.type === 'personNode'
        && Math.abs(n.position.y - anchor.position.y) < 10
        && Math.abs(n.position.x - desiredX) < CARD_W);
      if (occupant) occupant.position = { ...occupant.position, x: other.position.x };
      other.position = { ...other.position, x: desiredX };
    }

    const [left, right] = a.position.x <= b.position.x ? [a, b] : [b, a];
    const hx = (left.position.x + CARD_W + right.position.x) / 2 - HEART_W / 2;
    const hy = (left.position.y + right.position.y) / 2 + CARD_H / 2 - HEART_H / 2;

    const mid = `marriage-${p.id}`;
    nodes.push({
      id: mid, type: 'marriageNode', position: { x: hx, y: hy },
      data: {}, selectable: false, deletable: false, zIndex: 10,
    });
    edges.push(mkStraight(left.id,  'couple-r', mid, 'left'));
    edges.push(mkStraight(right.id, 'couple-l', mid, 'right'));
  });

  return { nodes, edges };
};

// ─── Full layout pipeline ─────────────────────────────────────────────────────
const fullLayout = (personNodes) => {
  const persons = normalize(personNodes);
  const { junctions, edges } = buildGraph(persons);
  const positioned = runDagre([...persons, ...junctions], edges, persons);
  return insertMarriages(positioned, edges, persons);
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

// When two people become a couple, children listed under only one of them
// become children of both — so the whole family hangs from one junction.
const unifyCouple = (persons, aId, bId) => {
  persons.forEach(c => {
    const ps = c.data.parents;
    if (ps.length === 1 && (ps[0] === aId || ps[0] === bId))
      c.data.parents = [aId, bId];
  });
};

// Apply a new member's relationship to the relation graph.
// Mutates `persons` (already cloned) and returns the new node.
const applyRelation = (persons, newNode, connectToId, relationship) => {
  const target = persons.find(n => n.id === connectToId);
  if (!target) return newNode;
  const kind = classify(relationship);

  if (kind === 'parent') {
    // New person is a parent of the target; if the target already had a
    // parent, the two parents become a couple automatically.
    const existing = persons.find(n => n.id === target.data.parents[0]);
    target.data.parents = [...new Set([...target.data.parents, newNode.id])].slice(0, 2);
    if (existing && !existing.data.spouseId && !newNode.data.spouseId) {
      existing.data.spouseId = newNode.id;
      newNode.data.spouseId  = existing.id;
      unifyCouple([...persons, newNode], existing.id, newNode.id);
    }
  } else if (kind === 'child') {
    // Child of the target AND the target's spouse (both parents)
    newNode.data.parents = [target.id, target.data.spouseId].filter(Boolean);
  } else if (kind === 'spouse') {
    newNode.data.spouseId = target.id;
    target.data.spouseId  = newNode.id;
    unifyCouple([...persons, newNode], target.id, newNode.id);
  } else if (kind === 'sibling') {
    // Same parents as the target
    newNode.data.parents = [...target.data.parents];
  } else {
    // Generic relative — hang below the target
    newNode.data.parents = [target.id];
  }
  return newNode;
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

  // Add member — records the relation in the graph, then re-lays-out
  const handleAdd = async ({ connectToId, photo: rawPhoto, ...nodeData }) => {
    const photo   = rawPhoto ? await compressImage(rawPhoto) : null;
    const persons = normalize(toPersonNodes(nodes));
    const newNode = {
      id: uuidv4(), type: 'personNode', position: { x: 0, y: 0 },
      data: { ...nodeData, photo, parents: [], spouseId: null },
    };
    applyRelation(persons, newNode, connectToId, nodeData.relationship);
    const { nodes: n, edges: e } = fullLayout([...persons, newNode]);
    setNodes(n); setEdges(e);
    persist(n);
    setIsAddOpen(false);
    setTimeout(() => window.requestAnimationFrame(() => fitView()), 80);
  };

  // Delete selected person nodes and strip references to them
  const handleDelete = () => {
    const ids = new Set(selectedNodes.map(n => n.id));
    const persons = clonePersons(toPersonNodes(nodes))
      .filter(n => !ids.has(n.id))
      .map(n => ({
        ...n,
        data: {
          ...n.data,
          parents: n.data.parents.filter(p => !ids.has(p)),
          spouseId: ids.has(n.data.spouseId) ? null : n.data.spouseId,
        },
      }));
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
              <select required value={form.connectToId} onChange={e => setForm(f => ({ ...f, connectToId: e.target.value }))}>
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
