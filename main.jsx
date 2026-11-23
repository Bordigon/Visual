import React, { memo } from 'react';
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

/**
 * Nodo estático: solo renderiza los Handles que tienen alguna arista conectada.
 * Como el grafo no cambia, no necesita useUpdateNodeInternals ni efectos.
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
 * Construye el grafo completo UNA sola vez (a nivel de módulo).
 * Nodos y aristas ya salen con sus handles activos calculados.
 */
function buildGraphFromJson(data) {
  let autoPositionedCount = 0;
  const nodeMap = new Map();

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

      edges.push({
        id: `e-${sourceId}-${targetId}-${idx}`,
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
      });
    });
  });

  return { nodes, edges };
}

// Se calcula una única vez al cargar el módulo; el componente nunca vuelve a recalcular
const { nodes, edges } = buildGraphFromJson(rawData);

function FlowApp() {
  return (
    <div style={containerStyle}>
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
        fitView
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

// Sin StrictMode: evita el doble render en desarrollo
ReactDOM.createRoot(document.getElementById('root')).render(<FlowApp />);