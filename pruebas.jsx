import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import {
  ReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// 1. Componente de Arista Personalizada con contenido encima
function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) {
  const [count, setCount] = useState(0);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            backgroundColor: '#ffffff',
            padding: '4px 10px',
            borderRadius: '16px',
            border: '1px solid #2563eb',
            boxShadow: '0 2px 5px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontFamily: 'sans-serif',
          }}
          className="nodrag nopan"
        >
          <span>{data?.texto || 'Conexión'}</span>
          <button
            onClick={() => setCount((c) => c + 1)}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Clics: {count}
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// 2. Registro de tipos de aristas
const edgeTypes = {
  aristaConBoton: CustomEdge,
};

// 3. Nodos y aristas de prueba
const initialNodes = [
  {
    id: '1',
    position: { x: 100, y: 150 },
    data: { label: 'Nodo Inicio' },
  },
  {
    id: '2',
    position: { x: 450, y: 150 },
    data: { label: 'Nodo Destino' },
  },
];

const initialEdges = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    type: 'aristaConBoton',
    data: { texto: 'Envío' },
  },
];

// 4. Componente Principal conectado a tu index.html (#root)
const Main = () => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge({ ...params, type: 'aristaConBoton', data: { texto: 'Nueva' } }, eds)
      ),
    [setEdges]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};

// Montaje directo en el div id="root" de tu .html
ReactDOM.createRoot(document.getElementById('root')).render(<Main />);

