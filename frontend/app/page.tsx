'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Braces,
  Check,
  ChevronRight,
  Clipboard,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type CipherMode = 'caesar' | 'affine' | 'vigenere';
type Operation = 'decrypt' | 'encrypt';

type Candidate = {
  cipher: string;
  key: string;
  plaintext: string;
  score: number;
  detail: string;
};

type Analysis = {
  normalized_text: string;
  length: number;
  coincidence_index: number;
  classification: string;
  explanation: string;
  frequencies: { letter: string; count: number; percentage: number }[];
  candidates: Candidate[];
  key_lengths: { length: number; average_ic: number; kasiski_hits: number }[];
};

type Encryption = {
  normalized_text: string;
  ciphertext: string;
  cipher: string;
  key: string;
  length: number;
};

const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const modes: { value: CipherMode; label: string }[] = [
  { value: 'caesar', label: 'César' },
  { value: 'affine', label: 'Afín' },
  { value: 'vigenere', label: 'Vigenère' },
];

const chartConfig = {
  percentage: { label: 'Frecuencia', color: '#3aa69e' },
} satisfies ChartConfig;

function normalize(value: string) {
  const marker = '__ENYE__';
  return value
    .toLocaleUpperCase('es-CO')
    .replaceAll('Ñ', marker)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll(marker, 'Ñ')
    .split('')
    .filter((character) => ALPHABET.includes(character))
    .join('');
}

function apiBase() {
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://localhost:8000/api/v1';
  }
  return '/api/v1';
}

export default function Home() {
  const [ciphertext, setCiphertext] = useState('');
  const [operation, setOperation] = useState<Operation>('decrypt');
  const [mode, setMode] = useState<CipherMode>('caesar');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [encryption, setEncryption] = useState<Encryption | null>(null);
  const [shift, setShift] = useState('5');
  const [multiplier, setMultiplier] = useState('5');
  const [offset, setOffset] = useState('7');
  const [keyword, setKeyword] = useState('NUBE');
  const [activeCandidate, setActiveCandidate] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const normalized = useMemo(() => normalize(ciphertext), [ciphertext]);

  async function runAnalysis() {
    if (normalized.length < 2) {
      setError('Escribe al menos dos letras para iniciar el análisis.');
      return;
    }
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const response = await fetch(`${apiBase()}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciphertext, mode }),
      });
      const body = (await response.json()) as Analysis | { detail?: string };
      if (!response.ok) {
        throw new Error('detail' in body ? body.detail : 'No fue posible completar el análisis.');
      }
      setAnalysis(body as Analysis);
      setActiveCandidate(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'La API no está disponible.');
    } finally {
      setLoading(false);
    }
  }

  async function runEncryption() {
    setEncryption(null);
    if (!normalized.length) {
      setError('Escribe al menos una letra para encriptar.');
      return;
    }

    const payload: Record<string, string | number> = { plaintext: ciphertext, cipher: mode };
    if (mode === 'caesar') {
      const value = Number(shift);
      if (!Number.isInteger(value) || value < 0 || value > 26) {
        setError('El desplazamiento k debe ser un número entero entre 0 y 26.');
        return;
      }
      payload.shift = value;
    } else if (mode === 'affine') {
      const a = Number(multiplier);
      const b = Number(offset);
      if (!Number.isInteger(a) || a < 0 || a > 26) {
        setError('El multiplicador a debe ser un número entero entre 0 y 26.');
        return;
      }
      if ([0, 3, 6, 9, 12, 15, 18, 21, 24].includes(a)) {
        setError('El multiplicador a debe ser coprimo con 27; por ejemplo 5.');
        return;
      }
      if (!Number.isInteger(b) || b < 0 || b > 26) {
        setError('El desplazamiento b debe ser un número entero entre 0 y 26.');
        return;
      }
      payload.multiplier = a;
      payload.offset = b;
    } else {
      if (!normalize(keyword)) {
        setError('La palabra clave debe contener al menos una letra.');
        return;
      }
      payload.keyword = keyword;
    }

    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const response = await fetch(`${apiBase()}/encrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as Encryption | { detail?: string };
      if (!response.ok) {
        throw new Error('detail' in body ? body.detail : 'No fue posible encriptar el texto.');
      }
      setEncryption(body as Encryption);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'La API no está disponible.');
    } finally {
      setLoading(false);
    }
  }

  function changeOperation(next: Operation) {
    setOperation(next);
    setError('');
    setCopied(false);
  }

  const candidate = analysis?.candidates[activeCandidate];
  const topFrequencies = useMemo(
    () => [...(analysis?.frequencies ?? [])].sort((a, b) => b.count - a.count).slice(0, 12),
    [analysis],
  );

  async function copyPlaintext() {
    if (!candidate) return;
    await navigator.clipboard.writeText(candidate.plaintext);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function copyEncryption() {
    if (!encryption) return;
    await navigator.clipboard.writeText(encryption.ciphertext);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[560px] bg-[radial-gradient(circle_at_12%_18%,rgba(246,178,107,.26),transparent_26%),radial-gradient(circle_at_88%_8%,rgba(58,166,158,.2),transparent_30%)]" />

      <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <a className="flex items-center gap-3" href="#inicio" aria-label="Ir al laboratorio">
          <div className="grid size-10 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(20,102,98,.2)]">
            <Braces className="size-5" strokeWidth={2.4} />
          </div>
          <div>
            <p className="font-display text-xl font-bold leading-none tracking-[-0.02em]">CriptaLab</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Johann Sebastian Orjuela Heredia</p>
          </div>
        </a>
        <Badge className="hidden border-primary/15 bg-primary/10 text-primary sm:inline-flex" variant="outline">Seguridad 2026-II</Badge>
      </header>

      <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-12 pt-5 sm:px-8 lg:px-12 lg:pt-8" id="inicio">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)] lg:items-start" id="laboratorio">
          <Card className="border border-border/80 bg-card/95 py-0 shadow-[0_22px_70px_rgba(61,64,53,.1)] ring-0">
            <CardHeader className="flex-row items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">Entrada</p>
                <CardTitle className="font-display mt-1 text-2xl font-bold">{operation === 'decrypt' ? 'Criptograma' : 'Texto original'}</CardTitle>
              </div>
              <Badge className="bg-secondary text-secondary-foreground" variant="secondary">Alfabeto ES · 27</Badge>
            </CardHeader>
            <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="mt-5 grid grid-cols-2 rounded-xl border border-border bg-surface p-1" aria-label="Operación">
                {([['decrypt', 'Descifrar'], ['encrypt', 'Encriptar']] as const).map(([value, label]) => (
                  <button
                    aria-pressed={operation === value}
                    className={operation === value
                      ? 'rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm'
                      : 'rounded-lg px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground'}
                    key={value}
                    onClick={() => changeOperation(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="mb-2 mt-5 block text-sm font-semibold" htmlFor="ciphertext">
                {operation === 'decrypt' ? 'Pega el bloque cifrado' : 'Escribe el texto que quieres encriptar'}
              </label>
              <Textarea
                id="ciphertext"
                aria-describedby="cipher-help"
                className="min-h-[235px] resize-y rounded-2xl border-border bg-surface px-4 py-4 font-mono text-sm leading-7 tracking-[0.08em] shadow-inner focus-visible:border-primary focus-visible:ring-primary/15"
                onChange={(event) => {
                  setCiphertext(event.target.value);
                  setEncryption(null);
                }}
                placeholder={operation === 'decrypt' ? 'Escribe o pega aquí el criptograma…' : 'Ejemplo: Nos vemos mañana a las ocho…'}
                spellCheck={false}
                value={ciphertext}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground" id="cipher-help">Conservamos A–Z y Ñ; limpiamos espacios, tildes y signos.</p>
                <span className="font-mono text-xs font-bold text-primary">{normalized.length} caracteres</span>
              </div>

              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-semibold">{operation === 'decrypt' ? 'Método de ataque' : 'Algoritmo de cifrado'}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {modes.map((item) => (
                    <button
                      aria-pressed={mode === item.value}
                      className={mode === item.value
                        ? 'rounded-xl border border-primary bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition'
                        : 'rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground'}
                      key={item.value}
                      onClick={() => {
                        setMode(item.value);
                        setEncryption(null);
                        setError('');
                      }}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {operation === 'encrypt' && (
                <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
                  {mode === 'caesar' && (
                    <label className="block text-sm font-semibold" htmlFor="shift">
                      Desplazamiento k
                      <Input className="mt-2 h-11 bg-card" id="shift" inputMode="numeric" max={26} min={0} onChange={(event) => setShift(event.target.value)} type="number" value={shift} />
                    </label>
                  )}
                  {mode === 'affine' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-semibold" htmlFor="multiplier">
                        Multiplicador a
                        <Input className="mt-2 h-11 bg-card" id="multiplier" inputMode="numeric" max={26} min={0} onChange={(event) => setMultiplier(event.target.value)} type="number" value={multiplier} />
                      </label>
                      <label className="block text-sm font-semibold" htmlFor="offset">
                        Desplazamiento b
                        <Input className="mt-2 h-11 bg-card" id="offset" inputMode="numeric" max={26} min={0} onChange={(event) => setOffset(event.target.value)} type="number" value={offset} />
                      </label>
                      <p className="text-xs text-muted-foreground sm:col-span-2">a debe ser coprimo con 27. Ejemplo válido: a = 5, b = 7.</p>
                    </div>
                  )}
                  {mode === 'vigenere' && (
                    <label className="block text-sm font-semibold" htmlFor="keyword">
                      Palabra clave
                      <Input className="mt-2 h-11 bg-card font-mono uppercase" id="keyword" maxLength={64} onChange={(event) => setKeyword(event.target.value)} placeholder="NUBE" spellCheck={false} value={keyword} />
                    </label>
                  )}
                </div>
              )}

              {error && (
                <Alert className="mt-4 border-coral/40 bg-coral/10 text-coral-strong">
                  <AlertTitle>{operation === 'decrypt' ? 'No pudimos analizar todavía' : 'Revisa los datos del cifrado'}</AlertTitle>
                  <AlertDescription className="text-coral-strong/85">{error}</AlertDescription>
                </Alert>
              )}

              <Button className="mt-5 h-12 w-full rounded-xl bg-primary px-5 text-[15px] font-bold shadow-[0_10px_24px_rgba(20,102,98,.2)] hover:bg-primary/90" disabled={loading} onClick={() => void (operation === 'decrypt' ? runAnalysis() : runEncryption())}>
                {loading ? <LoaderCircle className="mr-1 size-4 animate-spin" /> : operation === 'decrypt' ? <Sparkles className="mr-1 size-4" /> : <LockKeyhole className="mr-1 size-4" />}
                {loading ? (operation === 'decrypt' ? 'Buscando patrones…' : 'Encriptando…') : (operation === 'decrypt' ? 'Analizar criptograma' : 'Encriptar texto')}
                {!loading && <ArrowRight className="ml-1 size-4" />}
              </Button>
            </CardContent>
          </Card>

          <div className={operation === 'decrypt' ? 'grid gap-5' : 'hidden'}>
            <Card className="relative overflow-hidden border-0 bg-primary py-0 text-primary-foreground ring-0">
              <div className="absolute right-[-42px] top-[-58px] size-44 rounded-full border-[28px] border-white/8" />
              <CardContent className="relative px-6 py-6 sm:px-7 sm:py-7">
                <div className="mb-7 flex items-start justify-between gap-4">
                  <div className="grid size-11 place-items-center rounded-2xl bg-white/12"><BarChart3 className="size-5" /></div>
                  <Badge className="border-white/15 bg-white/10 text-white" variant="outline">Diagnóstico</Badge>
                </div>
                <p className="text-sm font-medium text-white/70">Índice de coincidencia</p>
                <p className="font-display mt-1 text-5xl font-bold tracking-[-0.04em]">
                  {analysis ? analysis.coincidence_index.toFixed(4) : '—'}
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/15">
                  <div className="h-full rounded-full bg-mint transition-all duration-700" style={{ width: `${Math.min((analysis?.coincidence_index ?? 0) / 0.085 * 100, 100)}%` }} />
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">{analysis?.classification ?? 'Esperando el análisis'}</p>
                    <p className="mt-1 text-xs leading-5 text-white/65">{analysis?.explanation ?? 'El resultado aparecerá aquí.'}</p>
                  </div>
                  {analysis && <strong className="shrink-0 rounded-lg bg-mint px-2.5 py-1 text-xs text-ink">N = {analysis.length}</strong>}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-card py-0 ring-0">
              <CardHeader className="flex-row items-center justify-between px-6 pb-0 pt-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Distribución local</p>
                  <CardTitle className="font-display mt-1 text-xl font-bold">Letras dominantes</CardTitle>
                </div>
                <Badge className="border-coral/20 bg-coral/10 text-coral-strong" variant="outline">Top 12</Badge>
              </CardHeader>
              <CardContent className="px-3 pb-4 pt-2 sm:px-5">
                {analysis ? (
                  <ChartContainer className="h-[230px] w-full" config={chartConfig}>
                    <BarChart accessibilityLayer data={topFrequencies} margin={{ left: 0, right: 6, top: 15, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 4" />
                      <XAxis axisLine={false} dataKey="letter" tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} width={30} />
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={{ fill: 'rgba(58,166,158,.08)' }} />
                      <Bar dataKey="percentage" fill="var(--color-percentage)" radius={[7, 7, 2, 2]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="grid h-[230px] place-items-center text-sm text-muted-foreground">Analiza un texto para ver sus frecuencias.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {operation === 'encrypt' && (
            <Card className="relative min-h-[420px] overflow-hidden border-0 bg-primary py-0 text-primary-foreground ring-0">
              <div className="absolute right-[-52px] top-[-65px] size-52 rounded-full border-[34px] border-white/8" />
              <CardContent className="relative flex min-h-[420px] flex-col px-6 py-7 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid size-11 place-items-center rounded-2xl bg-white/12"><LockKeyhole className="size-5" /></div>
                  <Badge className="border-white/15 bg-white/10 text-white" variant="outline">Resultado</Badge>
                </div>
                {encryption ? (
                  <div className="mt-8 flex flex-1 flex-col">
                    <p className="text-sm font-medium text-white/70">Texto cifrado</p>
                    <div className="mt-3 max-h-[260px] flex-1 overflow-auto rounded-2xl bg-black/15 p-5 font-mono text-lg font-bold leading-8 tracking-[0.12em] break-all">
                      {encryption.ciphertext}
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{encryption.cipher} · {encryption.key}</p>
                        <p className="mt-1 text-xs text-white/65">{encryption.length} letras · mayúsculas y sin espacios</p>
                      </div>
                      <Button className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => void copyEncryption()} variant="outline">
                        {copied ? <Check className="mr-1 size-4" /> : <Clipboard className="mr-1 size-4" />}
                        {copied ? 'Copiado' : 'Copiar cifrado'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid flex-1 place-items-center text-center">
                    <div>
                      <p className="font-display text-2xl font-bold">El cifrado aparecerá aquí</p>
                      <p className="mt-2 text-sm text-white/65">Elige el algoritmo, completa su clave y encripta el texto.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <section className={operation === 'decrypt' ? 'mt-5' : 'hidden'} aria-labelledby="results-title">
          <Card className="border border-border bg-card py-0 ring-0">
            <CardHeader className="flex-row items-center justify-between border-b border-border px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">Criptoanálisis</p>
                <CardTitle className="font-display mt-1 text-2xl font-bold" id="results-title">Claves candidatas</CardTitle>
              </div>
              {candidate && <Badge className="bg-accent text-accent-foreground">Menor puntaje = mejor ajuste</Badge>}
            </CardHeader>
            <CardContent className="p-0">
              {candidate ? (
                <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="border-b border-border p-3 lg:border-b-0 lg:border-r">
                    {analysis?.candidates.map((item, index) => (
                      <button
                        className={index === activeCandidate
                          ? 'mb-2 flex w-full items-center justify-between rounded-xl bg-primary px-4 py-3 text-left text-primary-foreground'
                          : 'mb-2 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-surface'}
                        key={`${item.cipher}-${item.key}`}
                        onClick={() => setActiveCandidate(index)}
                        type="button"
                      >
                        <span>
                          <span className="block text-xs opacity-70">{item.cipher}</span>
                          <strong className="mt-0.5 block text-sm">{item.key}</strong>
                        </span>
                        <span className="flex items-center gap-1 font-mono text-xs opacity-70">{item.score.toFixed(1)}<ChevronRight className="size-4" /></span>
                      </button>
                    ))}
                  </div>
                  <div className="min-w-0 p-5 sm:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Mejor lectura encontrada</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge>{candidate.cipher}</Badge>
                          <strong className="font-mono text-sm text-primary">{candidate.key}</strong>
                        </div>
                      </div>
                      <Button className="rounded-xl" onClick={() => void copyPlaintext()} variant="outline">
                        {copied ? <Check className="mr-1 size-4 text-primary" /> : <Clipboard className="mr-1 size-4" />}
                        {copied ? 'Copiado' : 'Copiar texto'}
                      </Button>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">{candidate.detail}</p>
                    <div className="mt-5 max-h-[280px] overflow-auto rounded-2xl border border-border bg-surface p-5 font-mono text-sm leading-7 tracking-[0.06em] break-all">
                      {candidate.plaintext}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-[260px] place-items-center px-6 py-12 text-center">
                  <div>
                    <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><KeyRound className="size-5" /></div>
                    <p className="font-display mt-4 text-xl font-bold">Las claves aparecerán aquí</p>
                    <p className="mt-2 text-sm text-muted-foreground">Selecciona un método y ejecuta el análisis.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {operation === 'decrypt' && analysis && analysis.key_lengths.length > 0 && (
          <section className="mt-5 rounded-3xl border border-border bg-secondary/70 p-5 sm:p-7" aria-labelledby="kasiski-title">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><RotateCcw className="size-4" /></div>
              <div><p className="font-display text-xl font-bold" id="kasiski-title">Pistas de longitud · Kasiski</p><p className="text-sm text-muted-foreground">Compara repeticiones e IC por columnas.</p></div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {analysis.key_lengths.map((item) => (
                <div className="rounded-2xl border border-border bg-card p-4" key={item.length}>
                  <p className="text-xs font-semibold text-muted-foreground">Longitud</p>
                  <p className="font-display mt-1 text-3xl font-bold text-primary">{item.length}</p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">IC {item.average_ic.toFixed(4)}</p>
                  <p className="mt-1 text-xs font-semibold">{item.kasiski_hits} coincidencias</p>
                </div>
              ))}
            </div>
          </section>
        )}

      </section>
    </main>
  );
}
