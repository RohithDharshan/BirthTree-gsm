import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

localforage.config({
  name: 'BirthTreeApp',
  storeName: 'birth_tree_data'
});

export const getEvents = async () => {
  const events = await localforage.getItem('events');
  return events || [];
};

export const saveEvent = async (eventData) => {
  const events = await getEvents();
  const newEvent = { ...eventData, id: uuidv4() };
  events.push(newEvent);
  await localforage.setItem('events', events);
  console.log('✅ Event saved:', newEvent);
  return newEvent;
};

export const deleteEvent = async (id) => {
  const events = await getEvents();
  const newEvents = events.filter(e => e.id !== id);
  await localforage.setItem('events', newEvents);
  console.log('✅ Event deleted:', id);
  return newEvents;
};

export const getTreeNodes = async () => {
  const nodes = await localforage.getItem('treeNodes');
  const edges = await localforage.getItem('treeEdges');
  
  if (!nodes) {
    // Default root node
    const defaultNodes = [
      {
        id: 'root',
        type: 'personNode',
        position: { x: 250, y: 100 },
        data: { name: 'Me', relationship: 'Self', photo: null },
      }
    ];
    await localforage.setItem('treeNodes', defaultNodes);
    await localforage.setItem('treeEdges', []);
    console.log('✅ Default tree initialized');
    return { nodes: defaultNodes, edges: [] };
  }
  
  return { nodes: nodes || [], edges: edges || [] };
};

export const saveTreeData = async (nodes, edges) => {
  await localforage.setItem('treeNodes', nodes);
  await localforage.setItem('treeEdges', edges);
  console.log('✅ Tree data saved:', { nodeCount: nodes.length, edgeCount: edges.length });
};

// Debug utility to check storage status
export const checkStorageStatus = async () => {
  const events = await getEvents();
  const treeData = await getTreeNodes();
  return {
    events: events.length,
    nodes: treeData.nodes.length,
    edges: treeData.edges.length,
    driver: localforage.driver()
  };
};

