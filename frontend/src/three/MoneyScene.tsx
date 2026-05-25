import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

const OLIVE_LIGHT = new THREE.Color('#5A6B55')
const OLIVE_BRIGHT = new THREE.Color('#7A8E72')
const BLOOD = new THREE.Color('#8B1A1A')
const TAN = new THREE.Color('#B8A88A')
const BONE = new THREE.Color('#EAE4D4')

type Props = { progress: number }

export function MoneyScene({ progress }: Props) {
  return (
    <Canvas
      gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}
      dpr={[1, 2]}
      camera={{ position: [0, 1.2, 7.5], fov: 38, near: 0.1, far: 60 }}
      style={{ background: 'oklch(0.12 0.003 130)' }}
    >
      <fog attach="fog" args={['#0D0D0D', 9, 26]} />
      <CameraDrift progress={progress} />

      {/* As 4 cenas estão sempre no scene-graph; só o que muda é a
          visibilidade/escala/posição. Continuidade visual entre etapas. */}
      <SceneDiagnostico progress={progress} />
      <SceneInvestigacao progress={progress} />
      <SceneEstrategia progress={progress} />
      <SceneExecucao progress={progress} />
    </Canvas>
  )
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const easeOutExpo = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)

/** Janela [a, peak, b] → 0..1..0 com ease-out. */
function band(p: number, a: number, peak: number, b: number) {
  if (p <= a || p >= b) return 0
  if (p < peak) return easeOutExpo((p - a) / (peak - a))
  return easeOutExpo(1 - (p - peak) / (b - peak))
}

/** Rampa [a..b] → 0..1. */
const ramp = (p: number, a: number, b: number) =>
  Math.max(0, Math.min(1, (p - a) / (b - a)))

function setOpacityRecursive(obj: THREE.Object3D, value: number) {
  obj.traverse((c) => {
    const m = (c as THREE.LineSegments | THREE.Line | THREE.Mesh).material
    if (m && 'opacity' in m) {
      ;(m as THREE.Material & { opacity: number }).opacity = value
      ;(m as THREE.Material).transparent = true
      ;(m as THREE.Material).depthWrite = false
    }
  })
}

function CameraDrift({ progress }: { progress: number }) {
  const { camera } = useThree()
  useEffect(() => {
    // câmera passeia entre as 4 cenas (mais lateral nas etapas centrais)
    const x = Math.sin(progress * Math.PI * 1.5) * 1.4
    const y = 1.0 + Math.sin(progress * Math.PI) * 0.5
    const z = 8 - progress * 2.2
    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)
  }, [camera, progress])
  return null
}

function Wire({
  geometry,
  color,
  opacity = 1,
}: {
  geometry: THREE.BufferGeometry
  color: THREE.Color
  opacity?: number
}) {
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry])
  return (
    <lineSegments geometry={edges}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </lineSegments>
  )
}

/* ================================================================== */
/* 01 — DIAGNÓSTICO                                                    */
/*    Dossiê wireframe com tampa que abre, e 6 folhas que partem do    */
/*    espaço (espalhadas) e convergem para dentro da pasta.            */
/* ================================================================== */

const SHEET_ORBITS: Array<[number, number, number, number, number, number]> = [
  // x, y, z, rx, ry, rz — posições iniciais "espalhadas"
  [-3.2, 1.4, -1.5, 0.2, 0.4, 0.1],
  [3.0, 1.8, -0.5, -0.3, -0.2, 0.2],
  [-2.6, -0.8, 1.6, 0.1, -0.5, -0.2],
  [2.8, -1.2, 1.2, -0.2, 0.3, 0.4],
  [-1.8, 2.4, 0.8, 0.4, -0.1, -0.3],
  [2.0, 2.0, -2.0, -0.4, -0.3, 0.1],
]

function SceneDiagnostico({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const flapRef = useRef<THREE.Group>(null)
  const sheetsRef = useRef<THREE.Group>(null)
  const folderGeo = useMemo(
    () => new THREE.BoxGeometry(2.4, 0.08, 1.7),
    [],
  )
  const flapGeo = useMemo(
    () => new THREE.BoxGeometry(2.4, 0.02, 1.7),
    [],
  )
  const sheetGeo = useMemo(
    () => new THREE.PlaneGeometry(1.4, 0.95),
    [],
  )

  // marquinhas (linhas redigidas) sobre as folhas
  const sheetMarkings = useMemo(() => {
    const positions: number[] = []
    for (let i = 0; i < 5; i++) {
      const y = 0.3 - i * 0.18
      positions.push(-0.55, y, 0.001, 0.4 + Math.random() * 0.15, y, 0.001)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return g
  }, [])

  const visibility = band(progress, -0.05, 0.1, 0.32)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    setOpacityRecursive(groupRef.current, visibility)

    const open = easeOutExpo(ramp(progress, 0.05, 0.22))
    if (flapRef.current) {
      flapRef.current.rotation.x = -open * (Math.PI * 0.55)
      flapRef.current.position.y = 0.05
    }

    // folhas: convergem para dentro do dossiê conforme open aumenta
    if (sheetsRef.current) {
      sheetsRef.current.children.forEach((sheet, i) => {
        const orbit = SHEET_ORBITS[i]
        const t = open
        sheet.position.x = orbit[0] * (1 - t)
        sheet.position.y = orbit[1] * (1 - t) + 0.05 + i * 0.012
        sheet.position.z = orbit[2] * (1 - t)
        sheet.rotation.x = -Math.PI / 2 + orbit[3] * (1 - t) * 0.6
        sheet.rotation.y = orbit[4] * (1 - t) * 0.6
        sheet.rotation.z = orbit[5] * (1 - t) * 0.6
        // suave oscilação enquanto espalhadas
        if (t < 0.5) {
          sheet.position.y += Math.sin(progress * 30 + i) * 0.04 * (1 - t)
        }
      })
    }

    groupRef.current.rotation.y += delta * 0.08 * visibility
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* base do dossiê */}
      <Wire geometry={folderGeo} color={OLIVE_LIGHT} />
      {/* tampa que abre */}
      <group ref={flapRef} position={[0, 0.05, -0.85]}>
        <group position={[0, 0, 0.85]}>
          <Wire geometry={flapGeo} color={OLIVE_BRIGHT} />
        </group>
      </group>
      {/* folhas */}
      <group ref={sheetsRef}>
        {SHEET_ORBITS.map((_, i) => (
          <group key={i}>
            <Wire geometry={sheetGeo} color={TAN} opacity={0.85} />
            <lineSegments geometry={sheetMarkings}>
              <lineBasicMaterial
                color={OLIVE_BRIGHT}
                transparent
                opacity={0.7}
                depthWrite={false}
              />
            </lineSegments>
          </group>
        ))}
      </group>
    </group>
  )
}

/* ================================================================== */
/* 02 — INVESTIGAÇÃO                                                   */
/*    Grafo de empresas / sócios. Edges aparecem progressivamente.     */
/* ================================================================== */

type Node = {
  pos: [number, number, number]
  size: number
  flagged?: boolean
}

const NODES: Node[] = [
  { pos: [0, 0.2, 0], size: 0.22 }, // núcleo
  { pos: [2.4, 0.9, -0.8], size: 0.16 },
  { pos: [-2.6, 0.6, -0.4], size: 0.16, flagged: true },
  { pos: [1.6, -1.1, 0.9], size: 0.14 },
  { pos: [-1.8, -0.9, 1.1], size: 0.14, flagged: true },
  { pos: [0.7, 1.8, -1.4], size: 0.13 },
  { pos: [-0.9, 1.4, 1.0], size: 0.13 },
  { pos: [3.0, -0.4, 1.4], size: 0.13 },
  { pos: [-2.4, -1.6, -0.2], size: 0.12 },
  { pos: [1.0, 2.3, 0.4], size: 0.11 },
  { pos: [-1.4, 2.0, -1.0], size: 0.11, flagged: true },
  { pos: [2.0, -2.0, -0.6], size: 0.12 },
]

const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [1, 7],
  [1, 5],
  [2, 8],
  [2, 10],
  [3, 7],
  [3, 11],
  [4, 8],
  [4, 6],
  [5, 9],
  [5, 10],
  [6, 9],
  [7, 11],
  [3, 4],
  [10, 6],
  [2, 1],
  [4, 11],
]

/** Path principal da Estratégia: caminho que conecta evidências críticas. */
const STRATEGY_PATH = [4, 8, 2, 10, 0] as const

function SceneInvestigacao({ progress }: { progress: number }) {
  const visibility = band(progress, 0.18, 0.4, 0.62)
  const groupRef = useRef<THREE.Group>(null)
  const edgesRef = useRef<THREE.LineSegments>(null)

  const fullEdgeGeo = useMemo(() => {
    const positions: number[] = []
    EDGES.forEach(([a, b]) => {
      positions.push(...NODES[a].pos, ...NODES[b].pos)
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    )
    return geo
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * 0.12 * visibility

    // edges aparecem progressivamente: ramp 0.2→0.4
    const drawn = easeOutExpo(ramp(progress, 0.2, 0.45))
    const totalEdges = EDGES.length
    const visibleEdges = Math.floor(drawn * totalEdges)
    if (edgesRef.current) {
      const geo = edgesRef.current.geometry as THREE.BufferGeometry
      geo.setDrawRange(0, visibleEdges * 2)
      const m = edgesRef.current.material as THREE.LineBasicMaterial
      // Durante a Estratégia (0.5+), as arestas comuns desbotam
      const fade = 1 - easeOutExpo(ramp(progress, 0.5, 0.7))
      m.opacity = visibility * fade
      m.transparent = true
    }
  })

  return (
    <group ref={groupRef}>
      <lineSegments ref={edgesRef} geometry={fullEdgeGeo}>
        <lineBasicMaterial
          color={OLIVE_LIGHT}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
      {NODES.map((n, i) => (
        <GraphNode
          key={i}
          node={n}
          progress={progress}
          baseOpacity={visibility}
          isOnPath={(STRATEGY_PATH as readonly number[]).includes(i)}
        />
      ))}
    </group>
  )
}

function GraphNode({
  node,
  progress,
  baseOpacity,
  isOnPath,
}: {
  node: Node
  progress: number
  baseOpacity: number
  isOnPath: boolean
}) {
  const ref = useRef<THREE.LineSegments>(null)
  const geo = useMemo(
    () => new THREE.IcosahedronGeometry(node.size, 0),
    [node.size],
  )

  useFrame(() => {
    if (!ref.current) return
    const m = ref.current.material as THREE.LineBasicMaterial
    const pulse = node.flagged
      ? 0.55 + 0.45 * Math.sin(progress * 30 + node.pos[0])
      : 1
    // durante estratégia, nós no caminho ganham, demais perdem
    const stratFade = easeOutExpo(ramp(progress, 0.5, 0.7))
    const pathBoost = isOnPath ? stratFade : -stratFade
    m.opacity = Math.max(0, baseOpacity * pulse + pathBoost)
    m.color.copy(node.flagged ? BLOOD : OLIVE_LIGHT)
    m.transparent = true
    ref.current.rotation.x += 0.004
    ref.current.rotation.y += 0.006
  })

  return (
    <lineSegments ref={ref} position={node.pos}>
      <edgesGeometry args={[geo]} />
      <lineBasicMaterial transparent opacity={0} depthWrite={false} />
    </lineSegments>
  )
}

/* ================================================================== */
/* 03 — ESTRATÉGIA                                                     */
/*    Sobre o grafo, desenha-se um único caminho (a tese escolhida).   */
/* ================================================================== */

function SceneEstrategia({ progress }: { progress: number }) {
  const visibility = band(progress, 0.48, 0.62, 0.82)
  const pathRef = useRef<THREE.LineSegments>(null)
  const altsRef = useRef<THREE.LineSegments>(null)

  // caminho principal como pares de segmentos (a→b, b→c, c→d, ...)
  const pathGeo = useMemo(() => {
    const positions: number[] = []
    for (let i = 0; i < STRATEGY_PATH.length - 1; i++) {
      positions.push(
        ...NODES[STRATEGY_PATH[i]].pos,
        ...NODES[STRATEGY_PATH[i + 1]].pos,
      )
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    )
    return geo
  }, [])

  const totalPathSegments = STRATEGY_PATH.length - 1

  // três paths alternativos (teses possíveis) que aparecem e somem
  const alternativesGeo = useMemo(() => {
    const positions: number[] = []
    const alts: number[][] = [
      [10, 6, 9, 5, 0],
      [4, 3, 7, 1, 0],
      [2, 8, 4, 11, 0],
    ]
    alts.forEach((path) => {
      for (let i = 0; i < path.length - 1; i++) {
        positions.push(...NODES[path[i]].pos, ...NODES[path[i + 1]].pos)
      }
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    )
    return geo
  }, [])

  useFrame(() => {
    // caminho principal "se desenha" entre 0.5 e 0.7
    const drawn = easeOutExpo(ramp(progress, 0.5, 0.7))
    if (pathRef.current) {
      const geo = pathRef.current.geometry as THREE.BufferGeometry
      const visibleSegs = Math.max(1, Math.floor(drawn * totalPathSegments))
      geo.setDrawRange(0, visibleSegs * 2)
      const m = pathRef.current.material as THREE.LineBasicMaterial
      m.opacity = visibility
      m.transparent = true
    }
    if (altsRef.current) {
      const m = altsRef.current.material as THREE.LineBasicMaterial
      const altBand = band(progress, 0.48, 0.56, 0.66)
      m.opacity = altBand * 0.35
      m.transparent = true
    }
  })

  return (
    <group>
      <lineSegments ref={altsRef} geometry={alternativesGeo}>
        <lineBasicMaterial
          color={TAN}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments ref={pathRef} geometry={pathGeo}>
        <lineBasicMaterial
          color={BONE}
          linewidth={2}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

/* ================================================================== */
/* 04 — EXECUÇÃO                                                       */
/*    Um ativo viaja pelo caminho até o cubo central (credor).         */
/* ================================================================== */

function SceneExecucao({ progress }: { progress: number }) {
  const visibility = band(progress, 0.72, 0.9, 1.1)
  const creditorRef = useRef<THREE.LineSegments>(null)
  const creditorMeshRef = useRef<THREE.Mesh>(null)
  const assetRef = useRef<THREE.LineSegments>(null)

  const creditorGeo = useMemo(() => new THREE.BoxGeometry(1.0, 1.0, 1.0), [])
  const assetGeo = useMemo(
    () => new THREE.BoxGeometry(0.45, 0.45, 0.45),
    [],
  )

  // Caminho que o ativo percorre — inverso do strategy path (volta para o centro)
  const travelPoints = useMemo(
    () => STRATEGY_PATH.map((i) => NODES[i].pos),
    [],
  )

  useFrame((_, delta) => {
    // cubo "credor" no centro
    if (creditorRef.current) {
      const m = creditorRef.current.material as THREE.LineBasicMaterial
      m.opacity = visibility
      m.transparent = true
      creditorRef.current.rotation.y += delta * 0.3
      const grow = easeOutExpo(ramp(progress, 0.85, 1.0))
      creditorRef.current.scale.setScalar(0.6 + grow * 0.6)
    }
    if (creditorMeshRef.current) {
      const m = creditorMeshRef.current.material as THREE.MeshBasicMaterial
      m.opacity = visibility * 0.1
      m.transparent = true
      const grow = easeOutExpo(ramp(progress, 0.85, 1.0))
      creditorMeshRef.current.scale.setScalar(0.6 + grow * 0.6)
    }

    // ativo viajando pelo caminho
    if (assetRef.current) {
      const m = assetRef.current.material as THREE.LineBasicMaterial
      m.opacity = visibility
      m.transparent = true
      const travel = easeOutExpo(ramp(progress, 0.75, 0.95))
      const segs = travelPoints.length - 1
      const t = travel * segs
      const idx = Math.min(segs - 1, Math.floor(t))
      const lt = t - idx
      const a = travelPoints[idx]
      const b = travelPoints[idx + 1]
      assetRef.current.position.set(
        a[0] + (b[0] - a[0]) * lt,
        a[1] + (b[1] - a[1]) * lt,
        a[2] + (b[2] - a[2]) * lt,
      )
      assetRef.current.rotation.x += delta * 0.8
      assetRef.current.rotation.y += delta * 1.2
    }
  })

  return (
    <group>
      {/* credor — cubo wireframe + interior levemente translúcido */}
      <lineSegments ref={creditorRef} position={[0, 0, 0]}>
        <edgesGeometry args={[creditorGeo]} />
        <lineBasicMaterial color={BONE} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <mesh ref={creditorMeshRef} position={[0, 0, 0]}>
        <boxGeometry args={[1.0, 1.0, 1.0]} />
        <meshBasicMaterial
          color={OLIVE_BRIGHT}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* ativo em movimento */}
      <lineSegments ref={assetRef}>
        <edgesGeometry args={[assetGeo]} />
        <lineBasicMaterial color={OLIVE_BRIGHT} transparent opacity={0} depthWrite={false} />
      </lineSegments>
    </group>
  )
}
