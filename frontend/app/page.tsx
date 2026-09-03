'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Braces,
  Check,
  ChevronRight,
  Clipboard,
  KeyRound,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Textarea } from '@/components/ui/textarea';

type CipherMode = 'auto' | 'caesar' | 'affine' | 'vigenere';

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

const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const SAMPLES = {
  César:
    'MFGPFXTGWJPFMNXYTWNFIJPFHWNUYTLWFKNFIJXIJPFFRYNLZJIFIQJRHNTRFRITVZJPFRJHJXNIFIIJTHZPYFWQJRXFÑJXMFJCNXYNITXNJQUWJUFWFUWTYJLJWXJHWJYTXQNPNYFWJXDUTPNYNHTX',
  Afín:
    'ASGITQHAIHRHITUTUVAFPAQEARQTHUXQBNBIHUIAZPHUQBNBIHAXIHHUBRIHUNHUQBNERAUARAITVTBNHAUGHWBIGAPNTZTARVBPBNGAPQTFPHVBUNBRBHIFHMAZTQBUQBRPAIHZTJHFHQTITVHV',
  Vigenère:
    'PYTGECCIXUNEDOJQNYÑMSGBCOJNSNFBQGOSMZAMSSMPHQNDMRMBVXUFQÑFFXOBMILKBVWWBPÑCBQPJFOOOSWBXFONNFKHHEESOFVEUNYZXJEXASEOCBWNFVWBXFONNQVUGFVNNDSYKVXNXPVNNFOQWUVBGFGNHJGNN',
};

const modes: { value: CipherMode; label: string }[] = [
  { value: 'auto', label: 'Automático' },
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
  const initialized = useRef(false);
  const [ciphertext, setCiphertext] = useState(SAMPLES.César);
  const [mode, setMode] = useState<CipherMode>('auto');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [activeCandidate, setActiveCandidate] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const normalized = useMemo(() => normalize(ciphertext), [ciphertext]);

  const runAnalysis = useCallback(async () => {
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
  }, [ciphertext, mode, normalized.length]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const timer = window.setTimeout(() => void runAnalysis(), 0);
    return () => window.clearTimeout(timer);
  }, [runAnalysis]);

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

  function loadSample(name: keyof typeof SAMPLES) {
    setCiphertext(SAMPLES[name]);
    setMode(name === 'César' ? 'caesar' : name === 'Afín' ? 'affine' : 'vigenere');
    setAnalysis(null);
    setError('');
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
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Orjuela · Heredia</p>
          </div>
        </a>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-muted-foreground sm:flex" aria-label="Principal">
          <a className="text-foreground transition-colors hover:text-primary" href="#laboratorio">Laboratorio</a>
          <a className="transition-colors hover:text-primary" href="#metodos">Métodos</a>
          <Badge className="border-primary/15 bg-primary/10 text-primary" variant="outline">Seguridad 2026-II</Badge>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-16 pt-7 sm:px-8 lg:px-12 lg:pt-10" id="inicio">
        <div className="mb-8 max-w-3xl lg:mb-10">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-4 text-coral" /> Criptoanálisis clásico, paso a paso
          </div>
          <h1 className="font-display text-[clamp(2.7rem,6vw,5.6rem)] font-bold leading-[0.92] tracking-[-0.055em] text-balance">
            Encuentra el patrón.<span className="block text-primary">Revela el mensaje.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Identifica César, Afín y Vigenère con evidencia visible: índice de coincidencia,
            frecuencias y candidatos de clave en un solo lugar.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)] lg:items-start" id="laboratorio">
          <Card className="border border-border/80 bg-card/95 py-0 shadow-[0_22px_70px_rgba(61,64,53,.1)] ring-0">
            <CardHeader className="flex-row items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">Entrada</p>
                <CardTitle className="font-display mt-1 text-xl font-bold">Criptograma</CardTitle>
              </div>
              <Badge className="bg-secondary text-secondary-foreground" variant="secondary">Alfabeto ES · 27</Badge>
            </CardHeader>
            <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="mb-4 mt-5 flex flex-wrap gap-2" aria-label="Ejemplos de validación">
                {Object.keys(SAMPLES).map((name) => (
                  <Button className="rounded-full" key={name} onClick={() => loadSample(name as keyof typeof SAMPLES)} size="sm" variant="outline">
                    Ejemplo {name}
                  </Button>
                ))}
              </div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="ciphertext">Pega el bloque cifrado</label>
              <Textarea
                id="ciphertext"
                aria-describedby="cipher-help"
                className="min-h-[235px] resize-y rounded-2xl border-border bg-surface px-4 py-4 font-mono text-sm leading-7 tracking-[0.08em] shadow-inner focus-visible:border-primary focus-visible:ring-primary/15"
                onChange={(event) => setCiphertext(event.target.value)}
                placeholder="Escribe o pega aquí el criptograma…"
                spellCheck={false}
                value={ciphertext}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground" id="cipher-help">Conservamos A–Z y Ñ; limpiamos espacios, tildes y signos.</p>
                <span className="font-mono text-xs font-bold text-primary">{normalized.length} caracteres</span>
              </div>

              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-semibold">Método de ataque</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {modes.map((item) => (
                    <button
                      aria-pressed={mode === item.value}
                      className={mode === item.value
                        ? 'rounded-xl border border-primary bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition'
                        : 'rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground'}
                      key={item.value}
                      onClick={() => setMode(item.value)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {error && (
                <Alert className="mt-4 border-coral/40 bg-coral/10 text-coral-strong">
                  <AlertTitle>No pudimos analizar todavía</AlertTitle>
                  <AlertDescription className="text-coral-strong/85">{error}</AlertDescription>
                </Alert>
              )}

              <Button className="mt-5 h-12 w-full rounded-xl bg-primary px-5 text-[15px] font-bold shadow-[0_10px_24px_rgba(20,102,98,.2)] hover:bg-primary/90" disabled={loading} onClick={() => void runAnalysis()}>
                {loading ? <LoaderCircle className="mr-1 size-4 animate-spin" /> : <Sparkles className="mr-1 size-4" />}
                {loading ? 'Buscando patrones…' : 'Analizar criptograma'}
                {!loading && <ArrowRight className="ml-1 size-4" />}
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-5">
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
        </div>

        <section className="mt-5" aria-labelledby="results-title">
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

        {analysis && analysis.key_lengths.length > 0 && (
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

        <section className="mt-16" id="metodos" aria-labelledby="methods-title">
          <div className="mb-7 flex items-end justify-between gap-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.13em] text-coral-strong">Cómo pensamos</p><h2 className="font-display mt-2 text-3xl font-bold tracking-tight" id="methods-title">Tres ataques, una ruta clara</h2></div>
            <BookOpen className="hidden size-7 text-primary sm:block" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { number: '01', title: 'César', copy: 'Probamos los 26 desplazamientos y ordenamos los resultados por cercanía al español.', tone: 'bg-coral/15 text-coral-strong' },
              { number: '02', title: 'Afín', copy: 'Evaluamos las 486 combinaciones válidas y mostramos el inverso modular utilizado.', tone: 'bg-accent text-accent-foreground' },
              { number: '03', title: 'Vigenère', copy: 'Buscamos secuencias repetidas, estimamos la longitud y resolvemos cada columna.', tone: 'bg-mint text-primary' },
            ].map((item) => (
              <Card className="border border-border bg-card py-0 ring-0" key={item.number}>
                <CardContent className="p-6">
                  <span className={`inline-grid size-10 place-items-center rounded-xl font-mono text-xs font-bold ${item.tone}`}>{item.number}</span>
                  <h3 className="font-display mt-7 text-2xl font-bold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </section>

      <footer className="relative z-10 border-t border-border bg-secondary/55">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Laboratorio académico · Universidad El Bosque</p>
          <p className="font-mono text-xs">orjuelaheredia.space</p>
        </div>
      </footer>
    </main>
  );
}
