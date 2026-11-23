import React, { memo, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlow, Background, Controls, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import rawData from './nodesData.json';

const CARDINAL_SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'bottom', position: Position.Bottom },
  { id: 'right', position: Position.Right },
  { id: 'left', position: Position.Left },
];

// Constantes fuera de los componentes: nunca se recrean
const handleStyle = { width: 8, height: 8, background: '#555' };

const nodeStyle = {
  padding: '10px 15px',
  borderRadius: 5,
  border: '1px solid #777',
  background: '#fff',
  color: '#222',
  fontSize: 12,
  textAlign: 'center',
  whiteSpace: 'pre-line',
  minWidth: 100,
};

const containerStyle = { width: '100vw', height: '100vh' };

const POPOVER_WIDTH = 260;

const popoverStyle = {
  position: 'fixed',
  width: POPOVER_WIDTH,
  maxHeight: '60vh',
  overflowY: 'auto',
  background: '#fff',
  color: '#222',
  border: '1px solid #ccc',
  borderRadius: 8,
  boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
  padding: 12,
  fontSize: 12,
  zIndex: 10,
};

const popoverTitleStyle = { fontWeight: 700, marginBottom: 8, whiteSpace: 'pre-line' };
const sectionTitleStyle = { fontWeight: 600, color: '#666', margin: '8px 0 4px' };
const listStyle = { margin: 0, paddingLeft: 18 };
const emptyStyle = { color: '#999', fontStyle: 'italic' };

// Hover de aristas + cursor de nodos resueltos con CSS: cero estado, cero re-renders
const flowCss = `
  .react-flow__node { cursor: pointer; }
  .react-flow__edge .react-flow__edge-path {
    stroke: #b1b1b7;
    stroke-width: 1.5;
    transition: stroke 0.15s, stroke-width 0.15s, filter 0.15s;
  }
  .react-flow__edge:hover .react-flow__edge-path {
    stroke: #ff9800;
    stroke-width: 3.5;
    filter: drop-shadow(0 0 6px #ff9800);
  }
  .react-flow__edge.selected .react-flow__edge-path {
    stroke: #b1b1b7;
    stroke-width: 1.5;
  }
  .react-flow__edge.selected:hover .react-flow__edge-path {
    stroke: #ff9800;
    stroke-width: 3.5;
  }
`;

/**
 * Nodo estático: solo renderiza los Handles que tienen alguna arista conectada.
 */
const CardinalNode = memo(function CardinalNode({ data }) {
  const active = data.activeHandles;

  return (
    <div style={nodeStyle}>
      {CARDINAL_SIDES.map(({ id, position }) => (
        <React.Fragment key={id}>
          {active[id].target && (
            <Handle
              type="target"
              position={position}
              id={id}
              style={handleStyle}
              isConnectable={false}
            />
          )}
          {active[id].source && (
            <Handle
              type="source"
              position={position}
              id={id}
              style={handleStyle}
              isConnectable={false}
            />
          )}
        </React.Fragment>
      ))}
      <div>{data.label}</div>
    </div>
  );
});

const nodeTypes = { cardinal: CardinalNode };

/**
 * Misma geometría en anillos concéntricos que antes,
 * con +100px de separación (radio base, paso entre anillos y espaciado entre nodos).
 */
function getAutoPosition(autoIndex) {
  if (autoIndex === 0) return { x: 0, y: 0 };

  const baseRadius = 320; // antes 220
  const radiusStep = 300; // antes 200
  const nodeSpacing = 270; // antes 170

  let ring = 1;
  let nodesRemaining = autoIndex;

  while (true) {
    const radius = baseRadius + (ring - 1) * radiusStep;
    const circumference = 2 * Math.PI * radius;
    const capacity = Math.max(6, Math.floor(circumference / nodeSpacing));

    if (nodesRemaining <= capacity) {
      const angle = ((nodesRemaining - 1) / capacity) * 2 * Math.PI;
      return {
        x: Math.round(radius * Math.cos(angle)),
        y: Math.round(radius * Math.sin(angle)),
      };
    }

    nodesRemaining -= capacity;
    ring++;
  }
}

function formatLabel(rawLabel, fallbackId) {
  if (Array.isArray(rawLabel)) return rawLabel.join('\n');
  if (typeof rawLabel === 'string') return rawLabel;
  return `Nodo ${fallbackId}`;
}

function getBestHandles(sourcePos, targetPos) {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' };
  }

  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' };
}

const createActiveHandles = () => ({
  top: { source: false, target: false },
  bottom: { source: false, target: false },
  right: { source: false, target: false },
  left: { source: false, target: false },
});

/**
 * Construye el grafo completo UNA sola vez (a nivel de módulo):
 *  - nodes / edges con sus handles activos
 *  - relations: para cada nodo, sus vecinos DIRECTOS (previos y siguientes),
 *    es decir, los conectados por una arista sin nodos intermedios.
 */
function buildGraphFromJson(data) {
  let autoPositionedCount = 0;
  const nodeMap = new Map();
  const prevSets = new Map();
  const nextSets = new Map();

  const nodes = data.map((item) => {
    const hasValidPosition =
      item.position &&
      typeof item.position.x === 'number' &&
      typeof item.position.y === 'number';

    const position = hasValidPosition
      ? { x: item.position.x, y: item.position.y }
      : getAutoPosition(autoPositionedCount++);

    const node = {
      id: String(item.id),
      type: 'cardinal',
      position,
      data: {
        label: formatLabel(item.label, item.id),
        activeHandles: createActiveHandles(),
      },
    };

    nodeMap.set(node.id, node);
    prevSets.set(node.id, new Set());
    nextSets.set(node.id, new Set());
    return node;
  });

  const edges = [];

  data.forEach((item) => {
    if (!Array.isArray(item.To)) return;

    const sourceId = String(item.id);
    const sourceNode = nodeMap.get(sourceId);
    if (!sourceNode) return;

    item.To.forEach((targetRawId, idx) => {
      const targetId = String(targetRawId);
      const targetNode = nodeMap.get(targetId);
      if (!targetNode) return;

      const { sourceHandle, targetHandle } = getBestHandles(
        sourceNode.position,
        targetNode.position
      );

      sourceNode.data.activeHandles[sourceHandle].source = true;
      targetNode.data.activeHandles[targetHandle].target = true;

      if (sourceId !== targetId) {
        nextSets.get(sourceId).add(targetId);
        prevSets.get(targetId).add(sourceId);
      }

      edges.push({
        id: `e-${sourceId}-${targetId}-${idx}`,
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
        selectable: true, // necesario para que la arista reciba el hover
        interactionWidth: 24, // zona de hover más ancha que la línea visible
      });
    });
  });

  const toLabels = (set) =>
    Array.from(set, (id) => nodeMap.get(id).data.label.replace(/\n/g, ' '));

  const relations = new Map();
  nodes.forEach((node) => {
    relations.set(node.id, {
      label: node.data.label,
      prev: toLabels(prevSets.get(node.id)),
      next: toLabels(nextSets.get(node.id)),
    });
  });

  return { nodes, edges, relations };
}

// Se calcula una única vez al cargar el módulo
const { nodes, edges, relations } = buildGraphFromJson(rawData);

function RelationList({ title, items }) {
  return (
    <>
      <div style={sectionTitleStyle}>{title}</div>
      {items.length === 0 ? (
        <div style={emptyStyle}>Ninguno</div>
      ) : (
        <ul style={listStyle}>
          {items.map((label, i) => (
            <li key={i}>{label}</li>
          ))}
        </ul>
      )}
    </>
  );
}

const NodePopover = memo(function NodePopover({ selected }) {
  const info = relations.get(selected.id);
  if (!info) return null;

  // Evita que el desplegable se salga de la pantalla
  const left = Math.max(8, Math.min(selected.x, window.innerWidth - POPOVER_WIDTH - 8));
  const top = Math.max(8, Math.min(selected.y, window.innerHeight - 120));

  return (
    <div style={{ ...popoverStyle, left, top }}>
      <div style={popoverTitleStyle}>{info.label}</div>
      <RelationList title="Vienen de (previos)" items={info.prev} />
      <RelationList title="Van hacia (siguientes)" items={info.next} />
    </div>
  );
});

/**
 * El grafo va en un componente memoizado con callbacks estables:
 * abrir/cerrar el desplegable NO vuelve a renderizar nodos ni aristas.
 */
const Graph = memo(function Graph({ onNodeClick, onClose }) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      edgesFocusable={false}
      nodesFocusable={false}
      onlyRenderVisibleElements
      onNodeClick={onNodeClick}
      onPaneClick={onClose}
      onMoveStart={onClose}
      fitView
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
});

function FlowApp() {
  const [selected, setSelected] = useState(null);

  const onNodeClick = useCallback((event, node) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = { id: node.id, x: rect.right + 10, y: rect.top };
    // Click sobre el mismo nodo = cerrar
    setSelected((prev) => (prev && prev.id === node.id ? null : next));
  }, []);

  // Cierra al hacer click en el fondo o al mover/hacer zoom (el desplegable es fijo en pantalla)
  const onClose = useCallback(() => setSelected(null), []);

  return (
    <div style={containerStyle}>
      <style>{flowCss}</style>
      <Graph onNodeClick={onNodeClick} onClose={onClose} />
      {selected && <NodePopover selected={selected} />}
    </div>
  );
}

// Sin StrictMode: evita el doble render en desarrollo
ReactDOM.createRoot(document.getElementById('root')).render(<FlowApp />);