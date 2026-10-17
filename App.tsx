import { type FormEvent, type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-qr-code';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  AlertTriangle, ArrowRight, Award, BarChart3, BellRing, Building2, Camera, Check, ChevronDown, ChevronLeft,
  CircleHelp, Clock3, Copy, CreditCard, Droplets, FileCheck2, Info, Layers, Leaf, Lock, LogOut, Mail, MapPin, Medal, Menu, Minus, Plus,
  House, Printer, QrCode, ReceiptText, ScanLine, Send, Settings2, Share, ShieldCheck, ShoppingBag,
  Sparkles, Trash2, TreePine, TrendingDown, TrendingUp, UserRound, Users, WalletCards, X, Zap,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  getGetAnalyticsSummaryQueryKey, getGetBetaStatusQueryKey, getGetImpactSummaryQueryKey, getGetMerchantOverviewQueryKey, getGetProfileQueryKey,
  getGetReceiptQueryKey, getListReceiptsQueryKey,
  useCheckInEcoStreak, useDeleteAccount, useDeleteReceipt,
  useClaimReceipt, useCreateReceipt, useGetAnalyticsSummary, useGetImpactSummary,
  useGetMerchantOverview, useGetProfile, useGetReceipt, useListReceipts,
  useSaveProfile,
} from '@workspace/api-client-react';
import type { Receipt, ReceiptInput } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { TreeExperience } from '@/components/tree-experience';
import NotFound from '@/pages/not-found';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { LanguageProvider, LanguageSwitcher, translate, useLanguage } from '@/i18n';
import { getStoredValue, removeStoredValue, setStoredValue } from '@/lib/safe-storage';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const money = (value = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const dateLabel = (value?: string, language: 'en' | 'es' = 'en') => value ? new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';

function Logo({ compact = false, showTagline = true }: { compact?: boolean; showTagline?: boolean }) {
  const { language } = useLanguage();
  return <Link href="/" aria-label={translate(language, 'FUTURERECEİPT home')} data-testid="link-logo" className="inline-flex flex-col items-start">
    {compact ? <span aria-hidden="true" className="text-[17px] font-bold leading-none tracking-[-.04em]"><span className="text-primary">FUTURE</span><span className="text-accent">RECEİPT</span></span> : <>
      <span className="inline-flex items-center text-[17px] font-bold leading-none tracking-[-.04em]"><span className="text-primary">FUTURE</span><span className="text-accent">RECEİPT</span></span>
       {showTagline && <span className="mt-1 flex flex-col text-[7px] font-semibold leading-[1.35] tracking-[.08em] text-muted-foreground">
          <span>{translate(language, 'Zero Paper, Zero Spam.')}</span>
          <span>{translate(language, 'Digital Receipt For a Green Future.')}</span>
      </span>}
    </>}
  </Link>;
}

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'soft' | 'plain' }) {
  const { language } = useLanguage();
  const styles = {
    primary: 'bg-primary text-primary-foreground shadow-[0_8px_18px_hsl(var(--primary)/.16)] hover:-translate-y-0.5',
    outline: 'border border-border bg-card text-foreground hover:border-primary/50 hover:bg-secondary/50',
    soft: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
    plain: 'text-muted-foreground hover:text-foreground',
  };
  return <button type="button" className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 ${styles[variant]} ${className}`} {...props}>{typeof children === 'string' ? translate(language, children) : children}</button>;
}

function Pill({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'orange' | 'stone' }) {
  const { language } = useLanguage();
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.12em] ${tone === 'green' ? 'bg-primary/10 text-primary' : tone === 'orange' ? 'bg-accent/15 text-[#a34921]' : 'bg-muted text-muted-foreground'}`}>{typeof children === 'string' ? translate(language, children) : children}</span>;
}

function Stat({ label, value, icon: Icon, accent = 'green', detail }: { label: string; value: string; icon: typeof Leaf; accent?: 'green' | 'orange'; detail?: string }) {
  const { language } = useLanguage();
  return <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-sm)]">
    <div className="mb-5 flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[.13em] text-muted-foreground">{translate(language, label)}</p><span className={`rounded-xl p-2 ${accent === 'green' ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-[#b25227]'}`}><Icon size={17} /></span></div>
    <p className="font-display text-3xl font-semibold tracking-[-.04em]" data-testid={`text-stat-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>
    {detail && <p className="mt-1.5 text-xs text-muted-foreground">{translate(language, detail)}</p>}
  </div>;
}

function SkeletonBlock({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />; }

function AuthLoadingScreen({ message = 'Checking your session…' }: { message?: string }) {
  const { language } = useLanguage();
  return (
    <main className="ecobill-noise grid min-h-[100dvh] place-items-center bg-[#eeeadf] px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-lg)] sm:p-8">
        <div className="flex justify-center"><Logo showTagline={false} /></div>
        <div className="mt-8 flex items-center justify-center gap-3 text-primary" role="status" aria-live="polite" data-testid="status-auth-loading">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">{translate(language, message)}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{translate(language, 'Please wait while we restore your account.')}</p>
      </section>
    </main>
  );
}

function SessionRequiredScreen() {
  const { language } = useLanguage();
  return (
    <main className="ecobill-noise grid min-h-[100dvh] place-items-center bg-[#eeeadf] px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-lg)] sm:p-8" data-testid="screen-session-required">
        <div className="flex justify-center"><Logo showTagline={false} /></div>
        <span className="mx-auto mt-8 grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><Lock size={25} /></span>
        <h1 className="mt-5 font-display text-2xl font-semibold">{translate(language, 'No active session')}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{translate(language, 'Sign in to continue.')}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/sign-in" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground" data-testid="link-session-sign-in">{translate(language, 'Sign in')}</Link>
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold text-foreground" data-testid="link-session-home">{translate(language, 'Back to home')}</Link>
        </div>
      </section>
    </main>
  );
}

function AccountLoadErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { language } = useLanguage();
  return (
    <main className="ecobill-noise grid min-h-[100dvh] place-items-center bg-[#eeeadf] px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-lg)] sm:p-8" data-testid="screen-account-load-error">
        <div className="flex justify-center"><Logo showTagline={false} /></div>
        <span className="mx-auto mt-8 grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-[#a34921]"><AlertTriangle size={25} /></span>
        <h1 className="mt-5 font-display text-2xl font-semibold">{translate(language, 'Could not load your account')}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{translate(language, 'Check your connection and try again.')}</p>
        <Button onClick={onRetry} className="mt-6 w-full sm:w-auto" data-testid="button-retry-account-load">{translate(language, 'Retry')}</Button>
      </section>
    </main>
  );
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = error.status;
  return typeof status === 'number' ? status : undefined;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  const { language } = useLanguage();
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><Pill>{eyebrow}</Pill><h1 className="mt-3 font-display text-4xl font-semibold tracking-[-.05em] md:text-5xl">{translate(language, title)}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{translate(language, description)}</p></div>{action}</div>;
}

function BetaDisclaimer() {
  const { language } = useLanguage();
  return (
    <div className="max-w-3xl text-[10px] leading-5 text-muted-foreground">
      <p className="font-bold uppercase tracking-[.14em] text-foreground/70">{translate(language, 'Beta Version - Free to Use')}</p>
      <p>
        {translate(language, "FUTURERECEİPT is currently in its Open Beta phase and is free to use. Features may change, be unavailable, or contain errors while we test and improve the platform. This service is provided 'as is' without any financial liabilities. We do not process payments or store sensitive financial data.")}
      </p>
    </div>
  );
}

function Home() {
  const { language } = useLanguage();
  const tr = (text: string) => translate(language, text);
  return <main className="ecobill-noise min-h-[100dvh] overflow-hidden">
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 md:px-10"><Logo /><div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex"><a href="#how-it-works" className="hover:text-foreground">{tr('How it works')}</a><a href="#for-business" className="hover:text-foreground">{tr('For businesses')}</a><a href="#impact" className="hover:text-foreground">{tr('Our impact')}</a><a href="#contact" className="hover:text-foreground">{language === 'es' ? 'Contacto' : 'Contact us'}</a></div><div className="flex items-center gap-2"><LanguageSwitcher /><Link href="/sign-in" className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground sm:inline-flex" data-testid="link-sign-in">{tr('Sign in')}</Link><Link href="/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_hsl(var(--primary)/.16)] transition hover:-translate-y-0.5" data-testid="link-sign-up">{tr('Get started')} <ArrowRight size={15} /></Link></div></nav>
    <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-12 md:grid-cols-[1.05fr_.95fr] md:px-10 md:pb-36 md:pt-20">
      <div className="relative z-10 animate-rise"><Pill tone="orange"><Sparkles size={12} /> {tr('receipts, rethought')}</Pill><h1 className="mt-6 max-w-3xl font-display text-[clamp(3.9rem,8vw,7.5rem)] font-semibold leading-[.88] tracking-[-.075em]">{language === 'es' ? <>Tu comprobante<br />de compra, <em className="text-primary not-italic">sin</em> papel.</> : <>Proof of purchase,<br /> <em className="text-primary not-italic">without</em> the paper.</>}</h1><p className="mt-8 max-w-lg text-lg leading-8 text-muted-foreground">{tr("A clear, private place for every receipt you earn. Scan the merchant's screen to claim your purchase. Know what you bought, where it came from, and what your choices are saving.")}</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/sign-up" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-[#3d2115] shadow-[0_12px_24px_hsl(var(--accent)/.2)] transition hover:-translate-y-0.5" data-testid="link-hero-sign-up">{tr('Create your free account')} <ArrowRight size={16} /></Link><Link href="/sign-in" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold transition hover:border-primary/50" data-testid="link-hero-sign-in">{tr('I already use FUTURERECEİPT')}</Link></div><div className="mt-11 flex items-center gap-7 border-t border-border/80 pt-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-primary" /> {tr('Private by design')}</span><span className="flex items-center gap-2"><Leaf size={16} className="text-primary" /> {tr('Less waste, more clarity')}</span></div></div>
      <div className="relative animate-rise delay-2"><div className="absolute -inset-5 rounded-[3rem] bg-[#dce9d7] blur-2xl dark:bg-primary/10" /><div className="relative mx-auto max-w-[450px] rotate-2 rounded-[2.2rem] border border-primary/10 bg-[#f5f1e6] p-3 shadow-[var(--shadow-lg)]"><div className="rounded-[1.8rem] bg-primary p-5 text-primary-foreground"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary-foreground/65">{tr('Scanner active')}</p><p className="mt-1 font-mono text-sm">{tr('Ready')}</p></div><Camera size={26} /></div><div className="mx-auto my-12 grid h-44 w-44 place-items-center rounded-2xl bg-[#23533e] p-4"><div className="grid h-full w-full place-items-center"><QrCode size={96} className="text-accent/80" /></div></div><div className="flex items-end justify-between"><div><p className="text-xs text-primary-foreground/65">{tr('Waiting for receipt')}</p><p className="mt-1 font-display text-xl">{tr('Point at POS screen.')}</p></div><span className="rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#3d2115]">{tr('scanning')}</span></div></div><div className="flex items-center justify-between px-3 pb-2 pt-4"><span className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">{tr('zero paper / zero spam')}</span><span className="text-xs text-muted-foreground">eco<span className="text-accent">bill</span></span></div></div><div className="absolute -bottom-6 -left-8 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-md)]"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-[#b25227]"><TreePine size={18} /></span><div><p className="font-mono text-lg font-medium">2.4 kg</p><p className="text-[11px] text-muted-foreground">{tr('paper saved this year')}</p></div></div></div></div>
    </section>
    <section id="how-it-works" className="border-y border-border/70 bg-[#eeeadf]/70 px-5 py-20 md:px-10 md:py-28"><div className="mx-auto max-w-7xl"><div className="max-w-xl"><Pill>one small switch</Pill><h2 className="mt-4 font-display text-4xl tracking-[-.05em] md:text-6xl">{tr('The receipt you can actually trust.')}</h2></div><div className="mt-14 grid gap-5 md:grid-cols-3"><Feature n="01" icon={Camera} title="Scan to claim" copy="Point your phone at the merchant's screen to securely claim your purchase. No email hunting, no paper slip." /><Feature n="02" icon={FileCheck2} title="Get it instantly" copy="Your receipt lands in your private history before your bag leaves the counter." /><Feature n="03" icon={BarChart3} title="See the story" copy="Understand your spending and the paper, trees, and carbon you kept in the ground." /></div></div></section>
    <section id="for-business" className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-[.8fr_1.2fr] md:px-10 md:py-32"><div><Pill tone="orange">for businesses worldwide</Pill><h2 className="mt-5 max-w-lg font-display text-4xl leading-[.98] tracking-[-.055em] md:text-6xl">{tr('A better last step at the register.')}</h2><p className="mt-6 max-w-md leading-7 text-muted-foreground">{tr('FUTURERECEİPT keeps your team moving. Send a verified receipt in a few taps, while your customers get a calmer record of every purchase.')}</p><Link href="/get-started" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-primary hover:gap-3" data-testid="link-business-sign-up">{tr('Set up your business')} <ArrowRight size={15} /></Link></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-3xl bg-primary p-7 text-primary-foreground sm:row-span-2"><Building2 size={22} className="mb-16 text-accent" /><h3 className="font-display text-3xl leading-tight">{tr('One focused POS flow. More time for people.')}</h3><p className="mt-5 text-sm leading-6 text-primary-foreground/70">{tr('No new hardware. No complicated back office. Just a receipt workflow your staff will remember after one use.')}</p></div><div className="rounded-3xl border border-border bg-card p-6"><CreditCard className="text-accent" size={21} /><h3 className="mt-10 font-display text-2xl">{tr('Built for trust')}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{tr('Every receipt gets a verification code customers can check.')}</p></div><div className="rounded-3xl border border-border bg-secondary/50 p-6"><TreePine className="text-primary" size={21} /><h3 className="mt-10 font-display text-2xl">{tr('Show your impact')}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{tr('Turn paper saved into a story your customers can see and share.')}</p></div></div></section>
    <section id="impact" className="bg-primary px-5 py-20 text-primary-foreground md:px-10 md:py-28"><div className="mx-auto grid max-w-7xl items-end gap-12 md:grid-cols-[1.2fr_.8fr]"><div><Pill tone="orange">the promise</Pill><h2 className="mt-5 max-w-3xl font-display text-5xl leading-[.92] tracking-[-.06em] md:text-7xl">{language === 'es' ? <>Cero papel, <span className="text-accent">cero spam.</span></> : <>Zero paper, <span className="text-accent">zero spam.</span></>}</h2><p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">{tr('Digital Receipt For a Green Future. Clear records for real life.')}</p></div><div className="border-l border-primary-foreground/20 pl-6 text-sm leading-7 text-primary-foreground/70"><div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[.12em] text-accent"><Zap size={14} /> {tr('a little less waste, every day')}</div></div></div></section>
    <section id="contact" className="scroll-mt-8 px-5 py-16 md:px-10 md:py-20" aria-labelledby="contact-title" data-testid="section-contact-us">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 rounded-[2rem] border border-border/70 bg-card p-7 shadow-[var(--shadow-sm)] md:flex-row md:items-center md:justify-between md:p-10">
        <div>
          <Pill tone="orange">{language === 'es' ? 'Contacto' : 'Contact us'}</Pill>
          <h2 id="contact-title" className="mt-4 font-display text-4xl tracking-[-.05em] md:text-5xl">
            {language === 'es' ? 'Hablemos.' : "We'd love to hear from you."}
          </h2>
          <p className="mt-3 max-w-xl leading-7 text-muted-foreground">
             {language === 'es' ? '¿Preguntas? Escríbenos.' : 'Questions? Write to us.'}
          </p>
        </div>
        <a
          href="mailto:futurereceiptfeedback@gmail.com"
          className="inline-flex min-h-12 max-w-full items-center gap-3 self-start rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 md:self-center"
          data-testid="link-contact-email"
        >
          <Mail size={17} className="shrink-0" aria-hidden="true" />
          <span className="break-all">futurereceiptfeedback@gmail.com</span>
          <ArrowRight size={15} className="shrink-0" aria-hidden="true" />
        </a>
      </div>
    </section>
    <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-xs text-muted-foreground md:px-10"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><Logo /><span>{tr('Goodbye Paper Receipts, Hello Green Future.')}</span><span>© {new Date().getFullYear()} FUTURERECEİPT</span></div><a href="mailto:futurereceiptfeedback@gmail.com" className="inline-flex items-center gap-2 border-t border-border/70 pt-5 transition hover:text-primary" data-testid="link-contact-email"><Mail size={14} aria-hidden="true" /><span>{language === 'es' ? 'Contáctanos' : 'Contact us'}:</span><span className="break-all font-medium text-foreground">futurereceiptfeedback@gmail.com</span></a><BetaDisclaimer /></footer>
  </main>;
}

function Feature({ n, icon: Icon, title, copy }: { n: string; icon: typeof Leaf; title: string; copy: string }) {
  const { language } = useLanguage();
  return <div className="border-t border-primary/25 pt-5"><div className="flex items-center justify-between"><span className="font-mono text-xs text-accent">{n}</span><Icon size={20} className="text-primary" /></div><h3 className="mt-10 font-display text-2xl">{translate(language, title)}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{translate(language, copy)}</p></div>;
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return <Home />;
  return isSignedIn ? <Redirect to="/dashboard" /> : <Home />;
}

function AuthPage({ mode }: { mode: 'in' | 'up' }) {
  const { language } = useLanguage();
  const tr = (text: string) => translate(language, text);
  const AuthComponent = mode === 'in' ? SignIn : SignUp;
  const pendingRole = getStoredValue('ECOBILL_PENDING_ACCOUNT_ROLE');
  const isMerchant = pendingRole === 'merchant';
  const roleLabel = tr(isMerchant ? 'Business account' : 'Customer account');
  const choicePath = mode === 'in' ? '/login' : '/get-started';
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [agreementError, setAgreementError] = useState(false);
  const authCardRef = useRef<HTMLDivElement>(null);
  const [signupButtonParent, setSignupButtonParent] = useState<HTMLElement | null>(null);

  const handleAuthSubmit = (event: FormEvent<HTMLDivElement>) => {
    if (mode === 'up' && !termsAccepted) {
      event.preventDefault();
      setAgreementError(true);
    }
  };

  const handleAuthClick = (event: MouseEvent<HTMLDivElement>) => {
    if (mode !== 'up' || termsAccepted) return;
    const button = (event.target as HTMLElement).closest('button');
    const label = button?.textContent?.trim().toLowerCase();
    if (button && (label === 'continue' || label === 'sign up' || label === 'create account' || label?.includes('google'))) {
      event.preventDefault();
      event.stopPropagation();
      setAgreementError(true);
    }
  };

  useEffect(() => {
    if (mode !== 'up') return;
    const root = authCardRef.current;
    if (!root) return;
    const findSubmitParent = () => {
      const submitButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
        .reverse()
        .find(button => ['continue', 'sign up', 'create account'].includes(button.textContent?.trim().toLowerCase() ?? ''));
      const parent = submitButton?.parentElement;
      if (!parent) return;
      let mount = parent.querySelector<HTMLElement>(':scope > [data-ecobill-agreement-mount]');
      if (!mount) {
        mount = document.createElement('div');
        mount.dataset.ecobillAgreementMount = 'true';
        mount.className = 'mb-3 w-full';
        parent.insertBefore(mount, submitButton);
      }
      setSignupButtonParent(mount);
    };
    findSubmitParent();
    const observer = new MutationObserver(findSubmitParent);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mode]);

  const agreement = (
    <div className="rounded-xl border border-border/80 bg-secondary/30 p-3 text-xs leading-5">
      <label className="flex cursor-pointer items-start gap-2.5 text-foreground">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={event => {
            setTermsAccepted(event.target.checked);
            if (event.target.checked) setAgreementError(false);
          }}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
          aria-invalid={agreementError}
          aria-describedby={agreementError ? 'signup-agreement-error' : undefined}
          data-testid="checkbox-signup-agreement"
        />
        <span>
          {language === 'es' ? 'Acepto los ' : 'I agree to the '}
          <a href={`${basePath}/terms`} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-2">{tr('Terms of Service')}</a>
          {language === 'es' ? ' y la ' : ' and '}
          <a href={`${basePath}/privacy`} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-2">{tr('Privacy Policy')}</a>.
        </span>
      </label>
      {agreementError && <p id="signup-agreement-error" className="mt-2 pl-6 text-destructive">{tr('Please accept the Terms of Service and Privacy Policy before signing up.')}</p>}
    </div>
  );
  
  return (
    <div className="ecobill-noise flex min-h-[100dvh] items-center justify-center bg-[#eeeadf] px-4 py-10">
      <div className="absolute left-6 top-6 md:left-10 md:top-8"><Logo /></div>
      <div className="absolute right-6 top-6 md:right-10 md:top-8"><LanguageSwitcher /></div>
      <div className="w-full max-w-[440px] flex flex-col items-center">
        {pendingRole && (
          <div className="mb-4 text-center animate-fade">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary shadow-[var(--shadow-sm)]">
              {isMerchant ? <Building2 size={12} /> : <UserRound size={12} />}
              {roleLabel}
            </span>
          </div>
        )}
        <div ref={authCardRef} className="w-full rounded-3xl border border-border bg-card p-1 shadow-[var(--shadow-lg)] relative" onSubmitCapture={handleAuthSubmit} onClickCapture={handleAuthClick}>
          <div className="rounded-[1.35rem] bg-card p-2">
            {mode === 'up' && <div className="flex justify-center pb-1 pt-5"><Logo showTagline={false} /></div>}
            {mode === 'up' && !signupButtonParent && <div className="mx-3 mb-2">{agreement}</div>}
            <AuthComponent routing="path" path={`${basePath}/sign-${mode}`} {...(mode === 'in' ? { signUpUrl: `${basePath}/sign-up` } : { signInUrl: `${basePath}/sign-in` })} />
          </div>
          {mode === 'up' && signupButtonParent && createPortal(agreement, signupButtonParent)}
        </div>
        {pendingRole && (
          <div className="mt-6 text-center animate-fade">
            <Link href={choicePath} className="text-sm font-semibold text-muted-foreground transition hover:text-foreground underline decoration-border underline-offset-4" data-testid="link-change-role">
              {tr('Choose a different account type')}
            </Link>
          </div>
        )}
        <footer className="mt-8 w-full px-2">
          <BetaDisclaimer />
        </footer>
      </div>
    </div>
  );
}

function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const { language } = useLanguage();
  const tr = (text: string) => translate(language, text);
  const isTerms = kind === 'terms';
  return (
    <div className="min-h-[100dvh] bg-background px-5 py-8 md:px-10 md:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between"><Logo /><LanguageSwitcher /></div>
        <Link href="/sign-up" className="mt-12 inline-flex text-sm font-semibold text-primary hover:underline">{tr('← Back to sign up')}</Link>
        <p className="mt-10 text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">FUTURERECEİPT</p>
        <h1 className="mt-3 font-display text-5xl tracking-[-.05em]">{tr(isTerms ? 'Terms of Service' : 'Privacy Policy')}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{tr(isTerms ? 'Open Beta' : 'Open Beta / Educational Project')}</p>
        <div className="mt-10 space-y-7 text-sm leading-7 text-foreground/80">
          {isTerms ? (
            <>
              <section><h2 className="font-display text-2xl text-foreground">{tr('Testing purpose')}</h2><p className="mt-2">{tr('FUTURERECEİPT is currently in an Open Beta for testing. Features may change, be unavailable, or contain errors.')}</p></section>
              <section><h2 className="font-display text-2xl text-foreground">{tr('Use of the platform')}</h2><p className="mt-2">{tr('You agree to use FUTURERECEİPT lawfully and understand that receipt records and environmental estimates are provided for informational purposes only.')}</p></section>
              <section><h2 className="font-display text-2xl text-foreground">{tr('No financial services')}</h2><p className="mt-2">{tr('FUTURERECEİPT does not process payments, move money, or provide financial advice. The platform is provided “as is” without financial liabilities.')}</p></section>
            </>
          ) : (
            <>
              <section><h2 className="font-display text-2xl text-foreground">{tr('Information we use')}</h2><p className="mt-2">{tr('FUTURERECEİPT uses account details and receipt information needed to provide digital receipt history, spending insights, and environmental estimates.')}</p></section>
              <section><h2 className="font-display text-2xl text-foreground">{tr('Sensitive financial data')}</h2><p className="mt-2">{tr('FUTURERECEİPT does not process payments or store full card numbers, CVVs, PINs, or other sensitive payment credentials. Only limited receipt details supplied by the merchant may be shown.')}</p></section>
              <section><h2 className="font-display text-2xl text-foreground">{tr('Your choices')}</h2><p className="mt-2">{tr('You can manage privacy preferences from Profile Settings and request account deletion from the app.')}</p></section>
            </>
          )}
        </div>
        <BetaDisclaimer />
      </div>
    </div>
  );
}

const appearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: { colorPrimary: '#285f46', colorForeground: '#23362d', colorMutedForeground: '#68766d', colorBackground: '#fffdf8', colorInput: '#f5f1e8', colorInputForeground: '#23362d', colorNeutral: '#d8d2c5', colorDanger: '#bd493c', fontFamily: 'DM Sans', borderRadius: '0.75rem' },
  elements: { rootBox: 'w-full', cardBox: 'w-full !bg-transparent !shadow-none', card: '!shadow-none !border-0 !bg-transparent', footer: '!shadow-none !border-0 !bg-transparent', logoImage: '!hidden', headerTitle: 'font-display !text-3xl !tracking-tight', headerSubtitle: '!text-muted-foreground', formFieldLabel: '!text-foreground', formFieldInput: '!rounded-xl !bg-[#f5f1e8]', formFieldInputShowPasswordButton: '!flex !text-foreground', formButtonPrimary: '!rounded-xl !bg-[#285f46] hover:!bg-[#1e4d38]', footerActionLink: '!text-[#285f46]', footerActionText: '!text-muted-foreground' },
};

function AppShell({ children }: { children: ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { language } = useLanguage();
  const { signOut } = useClerk();
  const [currentLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const handleSignOut = async () => {
    setSignOutError(false);
    try {
      await signOut({ redirectUrl: basePath || '/' });
    } catch (error) {
      console.error('Unable to sign out:', error);
      setSignOutError(true);
    }
  };
  const profileQuery = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      enabled: isLoaded && isSignedIn === true,
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });
  const profile = profileQuery.data;
  const role = profile?.role ?? 'customer';

  if (!isLoaded) return <AuthLoadingScreen />;
  if (isSignedIn !== true) return <SessionRequiredScreen />;
  if (!profile && (profileQuery.isLoading || profileQuery.isFetching)) {
    return <AuthLoadingScreen message="Loading your account…" />;
  }
  if (!profile && profileQuery.isError) {
    return <AccountLoadErrorScreen onRetry={() => { void profileQuery.refetch(); }} />;
  }
  
  const nav = role === 'merchant' 
    ? [
        { href: '/dashboard', label: 'Overview', icon: House }, 
        { href: '/pos', label: 'Register Simulator / QR', icon: QrCode }, 
        { href: '/receipts', label: 'Digital Receipts History', icon: FileCheck2 },
        { href: '/analytics', label: 'Sales Analytics', icon: BarChart3 }
      ] 
    : [
        { href: '/dashboard', label: 'Home', icon: WalletCards }, 
        { href: '/scan', label: 'Scan receipt', icon: Camera }, 
        { href: '/receipts', label: 'My receipts', icon: ReceiptText }, 
        { href: '/analytics', label: 'Spending & impact', icon: BarChart3 }
      ];

  const profileLabel = role === 'merchant' ? 'Store Config' : 'Profile settings';

  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[256px] flex-col border-r border-border/70 bg-[#f5f1e8] px-5 py-6 transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between">
          <Logo />
          <button className="rounded-lg p-2 text-muted-foreground md:hidden" onClick={() => setOpen(false)} data-testid="button-close-menu">
            <X size={18} />
          </button>
        </div>
        
        <div className="mt-12 rounded-2xl bg-primary p-4 text-primary-foreground">
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary-foreground/60">
            {translate(language, 'your account')}
          </p>
          <p className="mt-1 truncate font-display text-xl">
            {role === 'merchant' && profile?.businessName 
              ? `${profile.businessName}${profile.storeNumber ? ` #${profile.storeNumber}` : ''}` 
              : (profile?.name || user?.firstName || translate(language, 'Welcome'))
            }
          </p>
          <p className="mt-1 truncate text-xs text-primary-foreground/60">
            {profile?.email || user?.primaryEmailAddress?.emailAddress || ''}
          </p>
          {profile?.ecobillId && (
            <div className="mt-3 border-t border-primary-foreground/15 pt-3">
              {role === 'merchant' ? (
                <p className="font-mono text-xs font-bold tracking-wide" data-testid="text-sidebar-ecobill-id">
                   <span className="text-primary-foreground/60">FUTURERECEİPT ID:</span> {profile.ecobillId}
                </p>
              ) : (
                <>
                    <p className="text-[9px] font-bold uppercase tracking-[.14em] text-primary-foreground/55">{translate(language, 'FUTURERECEİPT Customer ID')}</p>
                  <p className="mt-1 font-mono text-sm font-bold tracking-wide" data-testid="text-sidebar-ecobill-id">{profile.ecobillId}</p>
                </>
              )}
            </div>
          )}
        </div>
        
        <nav className="mt-8 flex-1 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${currentLocation === href ? 'bg-card text-primary shadow-[var(--shadow-sm)]' : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'}`}>
              <Icon size={18} />
              {translate(language, label)}
            </Link>
          ))}
          <Link href="/profile" onClick={() => setOpen(false)} data-testid="link-nav-profile" className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${currentLocation === '/profile' ? 'bg-card text-primary shadow-[var(--shadow-sm)]' : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'}`}>
            <Settings2 size={18} />
            {translate(language, profileLabel)}
          </Link>
          <a href="mailto:futurereceiptfeedback@gmail.com?subject=FUTURERECEIPT%20Contact%20Us" onClick={() => setOpen(false)} data-testid="link-nav-contact-us" className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-card/50 hover:text-foreground">
            <Mail size={18} />
            {language === 'es' ? 'Contacto' : 'Contact us'}
          </a>
        </nav>
        
        <div className="border-t border-border/70 pt-5">
          {signOutError && <p className="mb-2 px-3.5 text-xs text-destructive" role="alert">{translate(language, 'Could not sign out right now. Please try again.')}</p>}
          <button onClick={() => { void handleSignOut(); }} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground" data-testid="button-log-out">
            <LogOut size={18} />
            {translate(language, 'Sign out')}
          </button>
        </div>
      </aside>
      
      {open && <button className="fixed inset-0 z-30 bg-foreground/20 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" data-testid="button-overlay" />}
      
      <div className="md:pl-[256px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border/60 bg-background/90 px-5 backdrop-blur-md md:px-10">
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-border bg-card p-2.5 md:hidden" onClick={() => setOpen(true)} data-testid="button-open-menu">
              <Menu size={19} />
            </button>
            <span className="hidden text-sm text-muted-foreground md:inline">
              {translate(language, 'Good to see you,')} <strong className="text-foreground">{role === 'merchant' && profile?.businessName ? profile.businessName : (profile?.name?.split(' ')[0] || user?.firstName || 'there')}</strong>.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground sm:flex">
              <ShieldCheck size={14} className="text-primary" /> {translate(language, 'Your data is private')}
            </div>
            <LanguageSwitcher />
            <a
              href="mailto:futurereceiptfeedback@gmail.com?subject=FUTURERECEIPT%20Contact%20Us"
              aria-label={language === 'es' ? 'Contacto' : 'Contact us'}
              data-testid="link-contact-us-authenticated"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              <Mail size={16} aria-hidden="true" />
              <span className="hidden sm:inline">{language === 'es' ? 'Contacto' : 'Contact us'}</span>
            </a>
            <Link href="/profile" className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" data-testid="link-header-profile">
              {(profile?.name || user?.firstName || 'E').slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-12">{children}</main>
        <footer className="mx-auto max-w-[1440px] px-5 pb-8 md:px-10"><BetaDisclaimer /></footer>
      </div>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const [location] = useLocation();
  const storedRole = getStoredValue('ECOBILL_PENDING_ACCOUNT_ROLE');
  const pendingRole = storedRole === 'merchant' || storedRole === 'customer' ? storedRole : undefined;
  const storedReferral = pendingRole === 'customer' ? getStoredValue('ECOBILL_REFERRAL_CODE') : null;
  const profile = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      enabled: isLoaded && isSignedIn === true,
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    request: {
      headers: {
        ...(pendingRole ? { 'X-ECOBILL-Account-Role': pendingRole } : {}),
        ...(storedReferral && /^ECB-[A-F0-9]{8}$/.test(storedReferral)
          ? { 'X-ECOBILL-Referral-Code': storedReferral }
          : {}),
      },
    },
  });
  const saveProfile = useSaveProfile();
  const [automaticProfileStarted, setAutomaticProfileStarted] = useState(false);
  useEffect(() => {
    if (!profile.data) return;
    removeStoredValue('ECOBILL_PENDING_ACCOUNT_ROLE');
    if (profile.data.role === 'customer') {
      removeStoredValue('ECOBILL_REFERRAL_CODE');
    }
  }, [profile.data]);
  useEffect(() => {
    if (
      isLoaded !== true ||
      isSignedIn !== true ||
      profile.data ||
      getErrorStatus(profile.error) !== 404 ||
      automaticProfileStarted
    ) return;
    setAutomaticProfileStarted(true);
    
    let pendingRole = getStoredValue('ECOBILL_PENDING_ACCOUNT_ROLE');
    if (pendingRole !== 'merchant' && pendingRole !== 'customer') pendingRole = 'customer';
    
    let referredByInviteCode: string | undefined = undefined;
    if (pendingRole === 'customer') {
      const storedCode = getStoredValue('ECOBILL_REFERRAL_CODE');
      if (storedCode && /^ECB-[A-F0-9]{8}$/.test(storedCode)) {
        referredByInviteCode = storedCode;
      }
    }
    
    saveProfile.mutate(
      { data: { role: pendingRole as 'customer' | 'merchant', referredByInviteCode } },
      { onSuccess: () => {
          removeStoredValue('ECOBILL_PENDING_ACCOUNT_ROLE');
          removeStoredValue('ECOBILL_REFERRAL_CODE');
          void profile.refetch();
        } 
      },
    );
  }, [automaticProfileStarted, isLoaded, isSignedIn, profile.data, profile.error, profile.refetch, saveProfile.mutate]);
  const profileErrorStatus = getErrorStatus(profile.error);
  const profileBootstrapPending = profileErrorStatus === 404 && !saveProfile.isError;
  if (isLoaded !== true) return <AuthLoadingScreen />;
  if (isSignedIn !== true) return <SessionRequiredScreen />;
  if (!profile.data && (profile.isLoading || profile.isFetching || saveProfile.isPending || profileBootstrapPending)) {
    return <AuthLoadingScreen message="Loading your account…" />;
  }
  if (!profile.data) {
    return (
      <AccountLoadErrorScreen
        onRetry={() => {
          if (profileErrorStatus === 404) {
            saveProfile.reset();
            setAutomaticProfileStarted(false);
          } else {
            void profile.refetch();
          }
        }}
      />
    );
  }
  if (location === '/onboarding') return <Redirect to="/dashboard" />;
  if (
    profile.data.role === 'merchant' &&
    !profile.data.businessName &&
    location !== '/profile'
  ) {
    return <Redirect to="/profile" />;
  }
  return <AppShell>{children}</AppShell>;
}

function Dashboard() {
  const profile = useGetProfile().data;
  return profile?.role === 'merchant' ? <MerchantDashboard /> : <CustomerDashboard />;
}

function CustomerDashboard() {
  const profile = useGetProfile().data;
  const analytics = useGetAnalyticsSummary();
  const impact = useGetImpactSummary();
  const receipts = useListReceipts();
  const list = receipts.data ?? [];
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const checkIn = useCheckInEcoStreak();
  const hasCheckedIn = useRef(false);

  useEffect(() => {
    if (profile && !hasCheckedIn.current) {
      hasCheckedIn.current = true;
      checkIn.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetImpactSummaryQueryKey() });
        }
      });
    }
  }, [profile, checkIn, queryClient]);

  const topMerchants = useMemo(() => {
    const map = new Map<string, { name: string; visits: number; total: number; latestId: string }>();
    list.forEach(r => {
      if (!map.has(r.merchantName)) {
        map.set(r.merchantName, { name: r.merchantName, visits: 0, total: 0, latestId: r.id });
      }
      const m = map.get(r.merchantName)!;
      m.visits += 1;
      m.total += r.total;
      if (r.id > m.latestId) m.latestId = r.id;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [list]);

  const dailyTrend = useMemo(() => {
    const days = 14;
    const data = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayReceipts = list.filter(r => r.purchasedAt.startsWith(dateStr));
      const total = dayReceipts.reduce((sum, r) => sum + r.total, 0);
      const biggestReceipt = dayReceipts.sort((a, b) => b.total - a.total)[0];

      data.push({
        date: dateStr,
        displayDate: new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(d),
        total,
        receiptId: biggestReceipt?.id
      });
    }
    return data;
  }, [list]);

  const COLORS = ['#285f46', '#e07641', '#88a67a', '#438062', '#b25227'];

  return (
    <div className="flex flex-col gap-10 animate-fade">
      {/* Greeting & Action */}
      <section className="relative overflow-hidden rounded-3xl bg-primary px-8 py-10 text-primary-foreground shadow-[var(--shadow-md)] md:px-12 md:py-14">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-accent">Welcome back</span>
            <h1 className="mt-5 max-w-full min-w-0 font-display text-4xl font-semibold leading-tight tracking-[-.02em] md:text-5xl">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, <br />
              <span
                className="block max-w-full truncate text-accent"
                title={profile?.name?.split(' ')[0] || 'there'}
                data-testid="text-dashboard-greeting-name"
              >
                {profile?.name?.split(' ')[0] || 'there'}.
              </span>
            </h1>
            
            <div className="mt-8 inline-flex items-center gap-4 rounded-2xl bg-white/10 p-3 backdrop-blur-md border border-white/10">
              <div className="rounded-xl bg-white/20 p-2"><QrCode size={20} className="text-white" /></div>
              <div className="pr-4">
                 <p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary-foreground/70">Your FUTURERECEİPT ID</p>
                <p className="font-mono text-lg font-medium tracking-wide">{profile?.ecobillId || 'Loading...'}</p>
              </div>
            </div>
          </div>

          <Link href="/scan" className="group inline-flex min-h-14 items-center gap-3 rounded-2xl bg-accent px-7 text-base font-bold text-[#3d2115] shadow-[0_8px_20px_hsl(var(--accent)/.3)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_24px_hsl(var(--accent)/.4)]" data-testid="link-hero-scan">
            <Camera size={20} className="transition-transform group-hover:scale-110" />
            Scan at checkout
          </Link>
        </div>
      </section>

      {/* Gamification Tree */}
      {impact.data && (
        <TreeExperience impact={impact.data} />
      )}

      {/* Eco-Impact Counter */}
      <section>
        <h2 className="mb-5 ml-1 font-mono text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Your Lifetime Impact</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Receipts" value={String(impact.data?.receipts ?? 0)} icon={ReceiptText} />
          <Stat label="Paper Saved" value={`${impact.data?.paperSaved ?? 0}g`} icon={FileCheck2} accent="orange" />
          <Stat label="Trees Saved" value={String(impact.data?.treesSaved ?? 0)} icon={TreePine} />
          <Stat label="CO₂ Avoided" value={`${impact.data?.co2Avoided ?? 0}kg`} icon={Leaf} accent="orange" />
          <Stat
            label="Clean Water Saved"
            value={`${impact.data?.waterSavedLiters ?? 0}L`}
            icon={Droplets}
            detail="Estimated from digital-only receipts"
          />
          <Stat
            label="Potential Carcinogen Exposure Avoided"
            value={`${impact.data?.digitalOnlyReceipts ?? 0} receipts`}
            icon={ShieldCheck}
            accent="orange"
            detail="Thermal paper contact avoided"
          />
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* Daily/Weekly Trend */}
        <section className="flex flex-col rounded-3xl border border-border/80 bg-card p-7 shadow-[var(--shadow-sm)] lg:col-span-2">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl font-semibold">Spending Trend</h3>
              <p className="mt-1 text-sm text-muted-foreground">Last 14 days</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            {receipts.isLoading ? (
              <SkeletonBlock className="h-full w-full" />
            ) : list.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState icon={BarChart3} title="No spending history" copy="Your trend will appear once you capture receipts." />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted)/.5)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-border bg-popover p-3 shadow-[var(--shadow-md)]">
                            <p className="text-xs text-muted-foreground">{payload[0].payload.displayDate}</p>
                            <p className="mt-1 font-mono text-lg font-bold text-foreground">
                              {money(payload[0].value as number)}
                            </p>
                            {payload[0].payload.receiptId && (
                              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-primary">Click to view receipt</p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="total" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                    onClick={(data) => {
                      const rId = data?.receiptId || data?.payload?.receiptId;
                      if (rId) setLocation(`/receipts/${rId}`);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Category Distribution */}
        <section className="flex flex-col rounded-3xl border border-border/80 bg-card p-7 shadow-[var(--shadow-sm)]">
          <div>
            <h3 className="font-display text-2xl font-semibold">Categories</h3>
            <p className="mt-1 text-sm text-muted-foreground">This month's breakdown</p>
          </div>
          
          <div className="mt-6 flex flex-1 flex-col justify-center">
            {analytics.isLoading ? (
              <SkeletonBlock className="h-48 w-full" />
            ) : analytics.data?.categories?.length ? (
              <>
                <div className="relative h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.data.categories}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="amount"
                        stroke="none"
                      >
                        {analytics.data.categories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-xl border border-border bg-popover p-3 shadow-[var(--shadow-md)]">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{payload[0].payload.name}</p>
                                <p className="mt-1 font-mono text-base font-bold text-foreground">
                                  {money(payload[0].value as number)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</span>
                    <span className="font-mono text-lg font-bold">{money(analytics.data.monthlySpend)}</span>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {analytics.data.categories.slice(0, 4).map((cat, i) => (
                    <div key={cat.name} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="min-w-0 break-words font-medium text-foreground">{cat.name}</span>
                      </div>
                      <span className="shrink-0 whitespace-nowrap font-mono text-muted-foreground">{cat.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={BarChart3} title="No data yet" copy="Your categories will appear here once you scan some receipts." action={<Link href="/scan" className="text-sm font-bold text-primary">Scan receipt</Link>} />
            )}
          </div>
        </section>
      </div>

      {/* Ranked Top Merchants */}
      <section className="rounded-3xl border border-border/80 bg-card p-7 shadow-[var(--shadow-sm)]">
        <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-display text-2xl font-semibold">Top Merchants</h3>
            <p className="mt-1 text-sm text-muted-foreground">Where you spend the most</p>
          </div>
          <Link href="/receipts" className="shrink-0 self-start text-xs font-bold text-primary hover:underline sm:self-auto">View all receipts</Link>
        </div>
        
        {receipts.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <SkeletonBlock key={i} className="h-20 w-full" />)}
          </div>
        ) : topMerchants.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topMerchants.map((m, i) => (
              <Link 
                key={m.name} 
                href={`/receipts/${m.latestId}`}
                className="group flex w-full min-w-0 items-center gap-3 rounded-2xl border border-border/50 bg-secondary/30 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/60 hover:shadow-[var(--shadow-sm)] sm:p-4"
                data-testid={`card-top-merchant-${m.latestId}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-mono text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    #{i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground transition-colors group-hover:text-primary">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.visits} {m.visits === 1 ? 'visit' : 'visits'}</p>
                  </div>
                </div>
                <div className="max-w-[45%] shrink-0 text-right">
                  <p className="truncate whitespace-nowrap font-mono text-sm font-bold text-foreground sm:text-base" title={money(m.total)}>{money(m.total)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={ShoppingBag} title="No merchants yet" copy="Your favorite places will show up here." />
        )}
      </section>
    </div>
  );
}

function MerchantDashboard() {
  const overview = useGetMerchantOverview();
  const profile = useGetProfile().data;
  const data = overview.data;
  const isWalmartPanel = profile?.businessName === 'Walmart' && profile.storeNumber === '04171';
  const featuredSavings = isWalmartPanel ? 142.5 : (data?.totalOperatingCostSaved ?? 0);
  const featuredTraffic = isWalmartPanel ? 124 : (data?.ecoBillAttributedNewCustomers ?? 0);

  return (
    <>
      <PageTitle 
        eyebrow="business dashboard" 
        title="Operational Overview" 
        description="Every digital receipt eliminates paper waste and cuts down store expenses. Keep track of your local impact and customer trends." 
        action={
          <Link href="/pos" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-[#3d2115]" data-testid="link-open-pos">
            <ScanLine size={16} /> Open POS
          </Link>
        } 
      />

      <section className="overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-[var(--shadow-md)]" data-testid="panel-business-performance">
        <div className="grid lg:grid-cols-[1.35fr_.65fr]">
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Pill tone="orange">digital receipt performance</Pill>
                <h2 className="mt-4 max-w-xl font-display text-4xl leading-[.98] tracking-[-.04em] md:text-5xl">Your store is growing greener.</h2>
                 <p className="mt-4 max-w-2xl text-sm leading-6 text-primary-foreground/70">Weekly digital receipts issued through FUTURERECEİPT. The trend rises as more customers choose paper-free checkout.</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/60">This month</p>
                <p className="mt-1 font-mono text-2xl font-bold">{data?.monthlyDigitalReceipts?.toLocaleString() ?? 0}</p>
              </div>
            </div>
            <div className="mt-8 h-64 rounded-2xl bg-white/[.06] p-4" data-testid="chart-digital-receipts">
              {overview.isLoading ? <SkeletonBlock className="h-full bg-white/10" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.digitalReceiptTrend ?? []} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,.13)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,.65)', fontSize: 12 }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,.55)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 0, color: '#183b2a' }} formatter={(value) => [`${Number(value)} receipts`, 'Digital receipts']} />
                    <Line type="monotone" dataKey="receipts" stroke="hsl(var(--accent))" strokeWidth={4} dot={{ r: 4, fill: 'hsl(var(--accent))', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#fff', stroke: 'hsl(var(--accent))', strokeWidth: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="grid gap-px bg-white/10 lg:grid-rows-2">
            <div className="flex flex-col justify-center bg-primary p-7 md:p-8">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[.13em] text-primary-foreground/60">Estimated Paper Cost Saved</p>
                <TrendingDown size={20} className="text-accent" />
              </div>
              <p className="mt-4 font-display text-5xl tracking-tight" data-testid="kpi-featured-paper-savings">{money(featuredSavings)}</p>
              <p className="mt-2 text-xs leading-5 text-primary-foreground/60">Estimated paper and printer operating costs avoided.</p>
            </div>
            <div className="flex flex-col justify-center bg-primary p-7 md:p-8">
              <div className="flex items-center justify-between gap-3">
                 <p className="text-xs font-bold uppercase tracking-[.13em] text-primary-foreground/60">FUTURERECEİPT Customer Traffic</p>
                <Users size={20} className="text-accent" />
              </div>
              <p className="mt-4 font-display text-5xl tracking-tight" data-testid="kpi-featured-customer-traffic">+{featuredTraffic.toLocaleString()} <span className="text-2xl">Users</span></p>
               <p className="mt-2 text-xs leading-5 text-primary-foreground/60">{isWalmartPanel ? 'Walmart demo baseline until live Green Map attribution is enabled.' : 'Customers attributed to FUTURERECEİPT Green Map discovery.'}</p>
            </div>
          </div>
        </div>
      </section>
      
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.isLoading ? [1,2,3,4].map(i => <SkeletonBlock key={i} className="h-36" />) : (
          <>
            <Stat label="Today's sales" value={money(data?.todaySales)} icon={CreditCard} />
            <Stat label="Receipts today" value={String(data?.todayReceiptCount ?? 0)} icon={ReceiptText} accent="orange" detail="customers served" />
            <Stat label="This month" value={money(data?.monthlySales)} icon={BarChart3} detail="gross receipt total" />
             <Stat label="Trees saved" value={String(data?.treesSaved ?? 0)} icon={TreePine} accent="orange" detail="through FUTURERECEİPT" />
          </>
        )}
      </div>

      {/* Paper Cost Savings Panel */}
      <section className="mt-8 rounded-3xl border border-border/80 bg-card shadow-[var(--shadow-sm)] overflow-hidden" data-testid="panel-paper-savings">
        <div className="border-b border-border/70 p-6 md:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <TrendingDown size={20} />
            </div>
            <div>
              <h2 className="font-display text-2xl">Paper Cost Savings</h2>
              <p className="mt-1 text-sm text-muted-foreground">Estimated reduction in operating expenses this month.</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 md:p-8">
          {overview.isLoading ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-20" />
              <SkeletonBlock className="h-10" />
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1fr_.8fr]">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Estimated operating cost saved this month</p>
                <p className="mt-2 font-display text-5xl tracking-tight text-primary" data-testid="kpi-total-saved">
                  {money(data?.totalOperatingCostSaved ?? 0)}
                </p>
                
                <p className="mt-6 text-sm leading-relaxed text-muted-foreground max-w-lg">
                   FUTURERECEİPT QR receipts helped you avoid an estimated <strong className="text-foreground">{data?.rollsAvoided?.toLocaleString() ?? 0} thermal paper rolls</strong> this month, plus related printer maintenance wear.
                </p>
                
                <details className="mt-6 group">
                  <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors list-none [&::-webkit-details-marker]:hidden">
                    <Info size={14} className="group-open:text-primary transition-colors" /> 
                    Methodology & Assumptions
                  </summary>
                  <div className="mt-3 rounded-xl bg-secondary/50 p-4 text-[13px] leading-relaxed text-muted-foreground border border-border/50">
                    Calculations are based on <strong>{data?.receiptsPerRollEstimate ?? 0} receipts per roll</strong> at an average cost of <strong>{money(data?.costPerRollEstimate ?? 0)} per roll</strong>. 
                    Actual savings vary by printer model, roll size, receipt length, supplier pricing, and maintenance plan. These are directional estimates, not guaranteed cash savings.
                  </div>
                </details>
              </div>
              
              <div className="grid gap-3 content-start">
                <div className="rounded-2xl border border-border bg-background p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Printer size={18} className="text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Thermal paper</span>
                  </div>
                  <span className="font-mono text-sm font-bold">{money(data?.paperCostSaved ?? 0)}</span>
                </div>
                
                <div className="rounded-2xl border border-border bg-background p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Settings2 size={18} className="text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Printer maintenance</span>
                  </div>
                  <span className="font-mono text-sm font-bold">{money(data?.printerMaintenanceSaved ?? 0)}</span>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4 flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <ReceiptText size={18} className="text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Digital receipts issued</span>
                  </div>
                  <span className="font-mono text-sm font-bold">{data?.monthlyDigitalReceipts?.toLocaleString() ?? 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Analytics Panels: Customer Growth & Product Association */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        
        {/* Customer Growth Panel */}
        <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8" data-testid="panel-customer-growth">
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Users size={20} />
            </div>
            <div>
              <h2 className="font-display text-2xl">New Customer Growth</h2>
            </div>
          </div>

          {overview.isLoading ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-20" />
              <SkeletonBlock className="h-10" />
            </div>
          ) : (
            <div>
              {data?.attributionTrackingActive && data?.ecoBillAttributedNewCustomers && data.ecoBillAttributedNewCustomers > 0 ? (
                <>
                  <p className="font-display text-4xl tracking-tight text-primary">
                    +{data.ecoBillAttributedNewCustomers}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                     FUTURERECEİPT-attributed customers
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    Customers whose first recorded purchase at this business was attributed to Green Map discovery.
                  </p>
                </>
              ) : (
                <div className="rounded-2xl bg-secondary/50 border border-border/50 p-5 mb-6 text-center">
                  <MapPin size={24} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-semibold text-foreground">Waiting for Green Map attribution</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground max-w-[250px] mx-auto">
                    No Green Map-attributed first visits recorded yet. Attribution will appear after tracked map referrals convert.
                  </p>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-border/70 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">All first-time customers this month</span>
                <span className="font-mono font-bold text-foreground">{data?.newCustomersThisMonth ?? 0}</span>
              </div>
            </div>
          )}
        </section>

        {/* Product Association Panel */}
        <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8" data-testid="panel-product-association">
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="font-display text-2xl">Frequently Bought Together</h2>
              <p className="mt-1 text-sm text-muted-foreground">Product Association</p>
            </div>
          </div>

          {overview.isLoading ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-16" />
              <SkeletonBlock className="h-16" />
            </div>
          ) : data?.productAssociation ? (
            <div>
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5 mb-5">
                <p className="text-[13px] leading-relaxed text-foreground">
                  Customers who bought <strong>{data.productAssociation.productA}</strong> also bought <strong>{data.productAssociation.productB}</strong> in <strong>{data.productAssociation.associationRate}%</strong> of qualifying baskets this week.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-xl border border-border bg-background p-4 text-center">
                  <p className="font-mono text-xl font-bold">{data.productAssociation.pairReceiptCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Joint baskets</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4 text-center">
                  <p className="font-mono text-xl font-bold">{data.productAssociation.productAReceiptCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Qualifying baskets</p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-4 rounded-xl bg-secondary/40 text-muted-foreground">
                <TrendingUp size={16} className="shrink-0 mt-0.5" />
                <p className="text-[13px] leading-relaxed">
                  Consider testing these items near each other or as a bundle, then compare results.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-secondary/50 border border-border/50 p-6 text-center mt-4">
              <ShoppingBag size={24} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-semibold text-foreground">More data needed</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                At least two matching weekly baskets are required before a reliable pattern is shown.
              </p>
            </div>
          )}
        </section>

      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">Activity</p>
              <h2 className="mt-1 font-display text-2xl">Recent receipts</h2>
            </div>
            <Link href="/analytics" className="text-sm font-bold text-primary" data-testid="link-merchant-analytics">View report</Link>
          </div>
          
          {overview.isLoading ? (
            <div className="space-y-3">
              <SkeletonBlock className="h-16" />
              <SkeletonBlock className="h-16" />
            </div>
          ) : data?.recentReceipts?.length ? (
            <div className="divide-y divide-border/70">
              {data.recentReceipts.slice(0, 5).map(receipt => (
                <ReceiptRow key={receipt.id} receipt={receipt} merchant />
              ))}
            </div>
          ) : (
            <EmptyState icon={ReceiptText} title="No sales yet today" copy="Issued receipts will show up here as customers check out." action={<Link href="/pos" className="text-sm font-bold text-primary" data-testid="link-empty-pos">Issue a receipt</Link>} />
          )}
        </section>

        <div className="rounded-3xl bg-primary p-7 text-primary-foreground md:p-8 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <Pill tone="orange"><TreePine size={12} /> impact at work</Pill>
          <h2 className="mt-5 max-w-xs font-display text-4xl leading-[.98]">Every sale leaves less behind.</h2>
          <p className="mt-5 max-w-sm text-sm leading-6 text-primary-foreground/70">Share your impact report with customers and make the paper-free choice visible.</p>
          <Link href="/analytics" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-bold text-primary-foreground transition hover:bg-white/20" data-testid="link-merchant-impact">
            Open impact report <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </>
  );
}

function ReceiptRow({ receipt, merchant = false }: { receipt: Receipt; merchant?: boolean }) {
  const { language } = useLanguage();
  return <Link href={`/receipts/${receipt.id}`} className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0" data-testid={`link-receipt-${receipt.id}`}>
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><ReceiptText size={18} /></div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold group-hover:text-primary">{merchant ? receipt.merchantName : receipt.merchantName}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{dateLabel(receipt.purchasedAt, language)} · {receipt.items?.length ?? 0} {language === 'es' ? 'artículos' : 'items'}</p>
      </div>
    </div>
    <div className="text-right"><p className="text-sm font-bold">{money(receipt.total)}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{receipt.verificationCode}</p></div>
  </Link>;
}

function ImpactCard({ impact }: { impact?: { receipts: number; paperSaved: number; treesSaved: number; co2Avoided: number } }) {
  return <section className="rounded-2xl bg-[#dfead9] p-7 text-primary"><div className="flex items-start justify-between"><div><Pill><Leaf size={12} /> your impact</Pill><h2 className="mt-5 font-display text-3xl leading-tight">Small receipts.<br />Real difference.</h2></div><TreePine size={28} className="text-primary/50" /></div><div className="mt-12 grid grid-cols-2 gap-y-5 border-t border-primary/15 pt-5"><div><p className="font-display text-2xl">{impact?.paperSaved ?? 0} g</p><p className="mt-1 text-xs text-primary/65">paper saved</p></div><div><p className="font-display text-2xl">{impact?.co2Avoided ?? 0} kg</p><p className="mt-1 text-xs text-primary/65">CO₂ avoided</p></div></div><Link href="/analytics" className="mt-7 inline-flex items-center gap-2 text-sm font-bold" data-testid="link-impact-details">See your full impact <ArrowRight size={15} /></Link></section>;
}

function EmptyState({ icon: Icon, title, copy, action }: { icon: typeof Leaf; title: string; copy: string; action?: ReactNode }) {
  const { language } = useLanguage();
  return <div className="grid justify-items-center px-6 py-12 text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><Icon size={24} /></span><h3 className="mt-4 font-display text-xl">{translate(language, title)}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{translate(language, copy)}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

type ReceiptDateRange = 'all' | 'month' | 'three-months' | 'year' | 'custom';

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthsBefore(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

function Receipts() {
  const { language } = useLanguage();
  const query = useListReceipts();
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<ReceiptDateRange>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const today = new Date();
  const todayValue = dateInputValue(today);
  const presetStart = dateRange === 'month'
    ? dateInputValue(monthsBefore(today, 1))
    : dateRange === 'three-months'
      ? dateInputValue(monthsBefore(today, 3))
      : dateRange === 'year'
        ? dateInputValue(monthsBefore(today, 12))
        : '';
  const filterFrom = dateRange === 'custom' ? dateFrom : presetStart;
  const filterTo = dateRange === 'custom' ? dateTo : dateRange === 'all' ? '' : todayValue;
  const hasSearch = Boolean(search.trim());
  const receipts = useMemo(() => (query.data ?? []).filter((receipt) => {
    if (hasSearch && !receipt.merchantName.toLowerCase().includes(search.trim().toLowerCase())) {
      return false;
    }
    if (!filterFrom && !filterTo) return true;

    const purchasedAt = new Date(receipt.purchasedAt);
    if (Number.isNaN(purchasedAt.getTime())) return false;
    const purchasedDate = dateInputValue(purchasedAt);
    return (!filterFrom || purchasedDate >= filterFrom) && (!filterTo || purchasedDate <= filterTo);
  }), [query.data, search, hasSearch, filterFrom, filterTo]);
  
  return (
    <>
       <PageTitle eyebrow="your archive" title="Receipts, all in one place." description="A searchable, verified record of every FUTURERECEİPT purchase." />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <ReceiptText size={17} className="absolute left-4 top-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by merchant" className="h-11 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm outline-none transition focus:border-primary" data-testid="input-search-receipts" />
        </div>
        <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground sm:w-48" data-testid="control-receipt-date-range">
          <Clock3 size={16} className="shrink-0" aria-hidden="true" />
          <span className="sr-only">{language === 'es' ? 'Filtrar recibos por fecha' : 'Filter receipts by date'}</span>
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value as ReceiptDateRange)}
            className="h-full min-w-0 flex-1 appearance-none bg-transparent text-foreground outline-none"
            aria-label={language === 'es' ? 'Filtrar recibos por fecha' : 'Filter receipts by date'}
            data-testid="select-receipt-date-range"
          >
            <option value="all">{language === 'es' ? 'Todo el tiempo' : 'All time'}</option>
            <option value="month">{language === 'es' ? '1 mes' : '1 month'}</option>
            <option value="three-months">{language === 'es' ? '3 meses' : '3 months'}</option>
            <option value="year">{language === 'es' ? '1 año' : '1 year'}</option>
            <option value="custom">{language === 'es' ? 'Fechas personalizadas' : 'Custom dates'}</option>
          </select>
          <ChevronDown size={15} className="shrink-0" aria-hidden="true" />
        </label>
      </div>
      {dateRange === 'custom' && (
        <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:max-w-xl sm:grid-cols-2" data-testid="controls-custom-receipt-dates">
          <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground" htmlFor="receipt-date-from">
            {language === 'es' ? 'Desde' : 'From'}
            <input
              id="receipt-date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary"
              data-testid="input-receipt-date-from"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground" htmlFor="receipt-date-to">
            {language === 'es' ? 'Hasta' : 'To'}
            <input
              id="receipt-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary"
              data-testid="input-receipt-date-to"
            />
          </label>
        </div>
      )}
      <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)]">
        {query.isLoading ? (
          <div className="space-y-3">
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
          </div>
        ) : query.isError ? (
          <EmptyState icon={CircleHelp} title="We couldn't load your receipts" copy="Try again in a moment. Your receipts are safe." action={<Button variant="outline" onClick={() => query.refetch()} data-testid="button-retry-receipts">Try again</Button>} />
        ) : receipts.length ? (
          <div className="divide-y divide-border/70">
            {receipts.map(receipt => (
              <Link 
                key={receipt.id} 
                href={`/receipts/${receipt.id}`} 
                className="flex w-full items-center justify-between gap-4 py-4 text-left transition first:pt-0 last:pb-0 hover:bg-secondary/30" 
                data-testid={`link-open-receipt-${receipt.id}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                    <ReceiptText size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{receipt.merchantName}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{dateLabel(receipt.purchasedAt)} · verified receipt</span>
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-3">
                  <strong className="text-sm">{money(receipt.total)}</strong>
                  <ArrowRight size={16} className="text-muted-foreground" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ReceiptText}
            title={hasSearch && dateRange !== 'all' ? 'No receipts match these filters' : hasSearch ? 'No receipts match that search' : dateRange !== 'all' ? 'No receipts in this date range' : 'Your receipt shelf is empty'}
            copy={hasSearch || dateRange !== 'all' ? 'Try changing your search or date range.' : 'Scan a POS QR code to claim your first receipt.'}
            action={!hasSearch && dateRange === 'all' ? <Link href="/scan" className="text-sm font-bold text-primary" data-testid="link-empty-scan">Scan a receipt</Link> : undefined}
          />
        )}
      </section>
    </>
  );
}

function ReceiptDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const tr = (text: string) => translate(language, text);
  const query = useGetReceipt(id);
  const profile = useGetProfile().data;
  const deleteReceipt = useDeleteReceipt();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  
  if (query.isLoading) return <><SkeletonBlock className="h-10 w-24" /><SkeletonBlock className="mt-4 h-96 max-w-2xl" /></>;
  if (!query.data) return <EmptyState icon={CircleHelp} title="Receipt not found" copy="This receipt may have moved or the link is incorrect." action={<Link href="/receipts" className="font-bold text-primary" data-testid="link-back-receipts">{tr('Back to receipts')}</Link>} />;
  
  const r = query.data;
  const isCustomerView = profile?.role === 'customer';
  const isCardPayment = Boolean(
    r.maskedCard ||
    r.paymentReferenceNumber ||
    r.networkId ||
    r.approvalCode ||
    r.aid ||
    r.applicationCryptogram ||
    r.paymentTerminalId ||
    /card|debit|credit|visa|mastercard|amex|discover/i.test(r.paymentMethod ?? '')
  );
  const isManualCardPayment = r.paymentMethod === 'card-manual';
  const tenderName = isManualCardPayment ? 'CARD PAID' : r.paymentMethod?.toUpperCase() || (isCardPayment ? 'CARD' : 'TENDER');
  
  const row = (label: string, value: string | number | null | undefined, padLeft = false) => {
    if (value == null || value === '') return null;
    return (
      <div className="flex justify-between gap-4 font-mono text-sm leading-6">
        <span className={padLeft ? 'pl-4' : ''}>{label}</span>
        <span className="text-right">{value}</span>
      </div>
    );
  };
  
  const centerRow = (value: string | null | undefined) => {
    if (value == null || value === '') return null;
    return <div className="text-center font-mono text-sm leading-6">{value}</div>;
  };

  const handlePrint = () => window.print();
  const handleDelete = () => {
    setDeleteError('');
    deleteReceipt.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetReceiptQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetAnalyticsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetImpactSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMerchantOverviewQueryKey() });
          setLocation('/receipts');
        },
        onError: () => setDeleteError(tr('Could not delete this receipt. Please try again.')),
      },
    );
  };

  return (
    <>
      <div className="mb-8 flex items-center justify-between print:hidden">
        <Link href="/receipts" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-back-receipts">
          <ChevronLeft size={16} /> {tr('All receipts')}
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="inline-flex h-9 items-center gap-2 rounded-xl bg-card border border-border px-3 text-sm font-semibold transition hover:bg-secondary">
            {tr('Print / Save Paper Copy')}
          </button>
          <button
            onClick={() => {
              setDeleteError('');
              setIsDeleteModalOpen(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 text-sm font-semibold text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
            data-testid="button-open-delete-receipt"
          >
            <Trash2 size={15} /> {tr('Delete')}
          </button>
        </div>
      </div>

    <div className="mx-auto max-w-[400px]">
        {/* Receipt Container */}
        <div className="receipt-edges print-receipt-only rounded-sm shadow-[0_12px_40px_rgba(0,0,0,0.15)] bg-white text-[#111] p-6 pb-8 print:shadow-none print:w-full print:max-w-none">
          
          {/* Header */}
          <div className="mb-6 flex flex-col items-center border-b-2 border-dashed border-[#ccc] pb-6">
            <h1 className="font-display text-2xl font-bold uppercase tracking-widest">{r.merchantName}</h1>
            {centerRow(r.merchantAddress)}
            {centerRow(r.merchantPhone)}
            {centerRow(r.managerName ? tr('Manager: {name}').replace('{name}', r.managerName) : null)}
          </div>

          {/* Transaction Metadata */}
          <div className="mb-6 border-b-2 border-dashed border-[#ccc] pb-6">
            {row(tr('ST#'), r.storeNumber)}
            {row(tr('OP#'), r.operatorNumber)}
            {row(tr('TE#'), r.terminalNumber)}
            {row(tr('TR#'), r.transactionNumber)}
            <div className="mt-2 text-center font-mono text-sm">
              {new Date(r.purchasedAt).toLocaleString(language === 'es' ? 'es-ES' : 'en-US', {
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', second: '2-digit'
              })}
            </div>
          </div>

          {/* Items */}
          <div className="mb-6 border-b-2 border-dashed border-[#ccc] pb-6">
            {r.items.map((item, i) => (
              <div key={`${item.name}-${i}`} className="mb-3 font-mono text-sm leading-6">
                <div className="flex justify-between gap-4">
                  <span>{item.name}</span>
                  <span className="shrink-0">{money(item.price * item.quantity)} {item.taxClass || ''}</span>
                </div>
                <div className="flex justify-between gap-4 text-[#555]">
                  <span>{item.barcode || ''}</span>
                  <span>{item.quantity} @ {money(item.price)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mb-6 border-b-2 border-dashed border-[#ccc] pb-6">
            {row(tr('SUBTOTAL'), money(r.subtotal))}
            {row(r.taxRate != null ? `${tr('TAX')} ${r.taxRate}%` : tr('TAX'), money(r.tax))}
            <div className="mt-2 flex justify-between font-mono text-lg font-bold">
              <span>{tr('TOTAL')}</span>
              <span>{money(r.total)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="mb-6 border-b-2 border-dashed border-[#ccc] pb-6">
            {row(isManualCardPayment ? tr('CARD PAID') : `${tr(tenderName)} ${language === 'es' ? 'PAGO' : 'TEND'}`, r.amountPaid != null ? money(r.amountPaid) : money(r.total))}
            {row(tr('CHANGE RETURNED'), r.changeDue != null ? money(r.changeDue) : null)}
            {isManualCardPayment ? (
              <div className="mt-5 border-t border-dashed border-[#bbb] pt-5">
                {row(tr('RECORD'), tr('MANUAL'))}
                {row(tr('APPR CODE'), r.approvalCode)}
              </div>
            ) : isCardPayment ? (
              <div className="mt-5 border-t border-dashed border-[#bbb] pt-5">
                {row(`EFT ${tr(tenderName)}`, r.amountPaid != null ? money(r.amountPaid) : money(r.total))}
                {row(tr('TOTAL PURCHASE'), money(r.total))}
                <div className="my-3 font-mono text-sm font-bold">{tenderName}</div>
                {row(tr('ACCOUNT'), r.maskedCard)}
                {row(tr('REF #'), r.paymentReferenceNumber)}
                {row(tr('NETWORK ID.'), r.networkId)}
                {row(tr('APPR CODE'), r.approvalCode)}
                {row(tr('AID'), r.aid)}
                {row(tr('AAC'), r.applicationCryptogram)}
                {row(tr('TERMINAL #'), r.paymentTerminalId)}
              </div>
            ) : null}
          </div>

           {/* Customer / FUTURERECEİPT Info */}
          <div className="text-center font-mono text-sm leading-6">
            <div className="mb-4">
              <div>{tr('TC#')} {r.tcCode || r.verificationCode}</div>
              {/* Fake barcode presentation for the TC code */}
              <div className="mx-auto mt-2 h-10 w-[80%] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIyIiBoZWlnaHQ9IjQwIiB4PSIwIiBmaWxsPSIjMDAwIi8+PHJlY3Qgd2lkdGg9IjEiIGhlaWdodD0iNDAiIHg9IjMiIGZpbGw9IiMwMDAiLz48cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0MCIgeD0iNiIgZmlsbD0iIzAwMCIvPjxyZWN0IHdpZHRoPSIyIiBoZWlnaHQ9IjQwIiB4PSIxMSIgZmlsbD0iIzAwMCIvPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjQwIiB4PSIxNSIgZmlsbD0iIzAwMCIvPjxyZWN0IHdpZHRoPSIzIiBoZWlnaHQ9IjQwIiB4PSIxOCIgZmlsbD0iIzAwMCIvPjxyZWN0IHdpZHRoPSIyIiBoZWlnaHQ9IjQwIiB4PSIyMyIgZmlsbD0iIzAwMCIvPjxyZWN0IHdpZHRoPSI1IiBoZWlnaHQ9IjQwIiB4PSIyNyIgZmlsbD0iIzAwMCIvPjwvc3ZnPg==')] bg-repeat-x opacity-40"></div>
            </div>

            {isCustomerView && (
              <div className="mb-4 border-t-2 border-dashed border-[#ccc] pt-4">
                <div className="font-bold">{tr('CUSTOMER COPY')}</div>
                <div>{profile.name}</div>
                <div>{tr('ID:')} {profile.ecobillId}</div>
              </div>
            )}

             <div className="mt-6 font-bold">*** FUTURERECEİPT ***</div>
            <div>{tr('Zero paper, zero spam.')}</div>
            <div>{tr('Digital Receipt For a Green Future.')}</div>
            {r.paperSavedGrams != null && r.paperSavedGrams > 0 && (
              <div className="mt-2 text-primary dark:text-[#285f46]">
                <div>{tr('Saved {amount}g of paper today.').replace('{amount}', String(r.paperSavedGrams))}</div>
                <div className="mt-1 font-bold">{tr('Thank you for helping save our green planet.')}</div>
              </div>
            )}
          </div>
          
        </div>
      </div>
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm animate-fade print:hidden">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-destructive/10 p-3 text-destructive">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-display text-2xl text-foreground">{tr('Delete receipt?')}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {isCustomerView
                    ? tr('This removes the receipt from your FUTURERECEİPT history. The merchant record remains available.')
                    : tr('This permanently removes this receipt from your merchant records.')}
                </p>
              </div>
            </div>
            {deleteError && <p className="mt-4 text-sm text-destructive">{deleteError}</p>}
            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                {tr('Cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteReceipt.isPending}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-destructive px-5 text-sm font-bold text-destructive-foreground transition disabled:opacity-50 hover:bg-destructive/90"
                data-testid="button-confirm-delete-receipt"
              >
                {tr(deleteReceipt.isPending ? 'Deleting...' : 'Delete receipt')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MonthlySpendChart({ data, loading }: { data: Array<{ month: string; amount: number }>; loading: boolean }) {
  return <section className="mt-6 rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)]">
    <p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">Monthly spending</p>
    <h2 className="mt-1 font-display text-2xl">What you spent over the last 6 months</h2>
    {loading ? <SkeletonBlock className="mt-7 h-72" /> : <div className="mt-7 h-72" data-testid="chart-monthly-spending">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs><linearGradient id="monthlySpendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} width={62} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={value => `$${value}`} />
          <Tooltip formatter={(value) => money(Number(value))} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
          <Area type="monotone" dataKey="amount" name="Spent" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#monthlySpendFill)" activeDot={{ r: 5, fill: 'hsl(var(--accent))', stroke: 'hsl(var(--card))', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>}
  </section>;
}

 function Analytics() {
  const profile = useGetProfile().data;
  const analytics = useGetAnalyticsSummary();
  const impact = useGetImpactSummary();
  const merchant = useGetMerchantOverview();
  const isMerchant = profile?.role === 'merchant';
  const categories = analytics.data?.categories ?? [];
  return <><PageTitle eyebrow={isMerchant ? 'business impact' : 'your insights'} title={isMerchant ? 'Impact you can share.' : 'The shape of your spending.'} description={isMerchant ? 'See the tangible difference your paper-free checkout makes, month by month.' : 'Simple signals from your receipts, with the context to make them useful.'} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{analytics.isLoading || impact.isLoading ? [1,2,3,4].map(i => <SkeletonBlock key={i} className="h-36" />) : <>{isMerchant ? <><Stat label="Monthly sales" value={money(merchant.data?.monthlySales)} icon={BarChart3} /><Stat label="Receipts issued" value={String(impact.data?.receipts ?? 0)} icon={ReceiptText} accent="orange" /><Stat label="Paper saved" value={`${impact.data?.paperSaved ?? 0} g`} icon={Leaf} /><Stat label="Trees saved" value={String(impact.data?.treesSaved ?? 0)} icon={TreePine} accent="orange" /></> : <><Stat label="Monthly spend" value={money(analytics.data?.monthlySpend)} icon={WalletCards} /><Stat label="Daily average" value={money(analytics.data?.dailySpend)} icon={BarChart3} accent="orange" /><Stat label="Receipts captured" value={String(analytics.data?.receiptCount ?? 0)} icon={ReceiptText} /><Stat label="Top category" value={analytics.data?.topCategory || '—'} icon={ShoppingBag} accent="orange" /></>}</>}</div>{isMerchant && <section className="mt-6 rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)]"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">Sales analytics</p><h2 className="mt-1 font-display text-2xl">Payment method breakdown</h2></div><p className="text-xs text-muted-foreground">Manual card records are included in sales totals.</p></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-secondary/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today · credit card</p><p className="mt-2 font-display text-2xl">{money(merchant.data?.todayCardSales)}</p><p className="mt-1 text-xs text-muted-foreground">{merchant.data?.todayCardReceiptCount ?? 0} transactions</p></div><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today · cash</p><p className="mt-2 font-display text-2xl">{money(merchant.data?.todayCashSales)}</p></div><div className="rounded-xl bg-secondary/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This month · credit card</p><p className="mt-2 font-display text-2xl">{money(merchant.data?.monthlyCardSales)}</p><p className="mt-1 text-xs text-muted-foreground">{merchant.data?.monthlyCardReceiptCount ?? 0} transactions</p></div><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This month · cash</p><p className="mt-2 font-display text-2xl">{money(merchant.data?.monthlyCashSales)}</p></div></div></section>}{!isMerchant && <MonthlySpendChart data={analytics.data?.monthlyTrend ?? []} loading={analytics.isLoading} />}<div className="mt-6 grid gap-5 lg:grid-cols-[1fr_.85fr]"><section className="rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)]"><p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">Category breakdown</p><h2 className="mt-1 font-display text-2xl">{isMerchant ? 'Your receipts at a glance' : 'Where your money goes'}</h2>{analytics.isLoading ? <div className="mt-7 space-y-5"><SkeletonBlock className="h-5" /><SkeletonBlock className="h-5" /><SkeletonBlock className="h-5" /></div> : categories.length ? <div className="mt-8 space-y-5">{categories.map((category, i) => <div key={category.name}><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">{category.name}</span><span className="font-mono text-xs text-muted-foreground">{money(category.amount)} · {category.percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${i % 2 ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${Math.min(category.percentage, 100)}%` }} /></div></div>)}</div> : <EmptyState icon={BarChart3} title="Insights are on their way" copy="Once you have a few receipts, patterns will appear here." />}</section><section className="rounded-2xl bg-primary p-7 text-primary-foreground"><Pill tone="orange"><Leaf size={12} /> positive footprint</Pill><h2 className="mt-5 font-display text-4xl leading-[.95]">Receipts that leave no trace.</h2><p className="mt-5 text-sm leading-6 text-primary-foreground/70">Your paper-free choices add up. Here's what FUTURERECEİPT has kept out of the bin.</p><div className="mt-10 space-y-5 border-t border-primary-foreground/20 pt-5"><div className="flex items-center justify-between"><span className="text-sm text-primary-foreground/70">Paper saved</span><strong className="font-display text-2xl">{impact.data?.paperSaved ?? 0} g</strong></div><div className="flex items-center justify-between"><span className="text-sm text-primary-foreground/70">Trees saved</span><strong className="font-display text-2xl">{impact.data?.treesSaved ?? 0}</strong></div><div className="flex items-center justify-between"><span className="text-sm text-primary-foreground/70">CO₂ avoided</span><strong className="font-display text-2xl">{impact.data?.co2Avoided ?? 0} kg</strong></div></div></section></div></>;
}

function PrintReceipt({ receipt }: { receipt: Receipt }) {
  // We remove this old implementation entirely, since ReceiptDetail now fully handles print layouts via .print-receipt-only.
  return null;
}

function Pos() {
  const createReceipt = useCreateReceipt();
  const queryClient = useQueryClient();
  const profile = useGetProfile().data;
  const [createdReceipt, setCreatedReceipt] = useState<Receipt | null>(null);
  const [, setLocation] = useLocation();
  const [merchantName, setMerchantName] = useState('');
  const [merchantAddress, setMerchantAddress] = useState('');
  const emptyLineItem = { name: '', quantity: 1, price: 0, barcode: '', taxClass: '' };
  const [items, setItems] = useState<Array<{ name: string; quantity: number; price: number; barcode: string; taxClass: string }>>([emptyLineItem]);
  const configuredFields = useMemo<Record<string, string>>(() => ({
    storeNumber: profile?.storeNumber ?? '',
    managerName: profile?.managerName ?? '',
    merchantPhone: profile?.phone ?? '',
    operatorNumber: profile?.operatorNumber ?? '',
    terminalNumber: profile?.terminalNumber ?? '',
    transactionNumber: profile?.transactionNumber ?? '',
    tcCode: profile?.tcCode ?? '',
    paymentMethod: 'cash',
    taxRate: profile?.taxRate == null ? '' : String(profile.taxRate),
  }), [profile]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [paperReceiptRequested, setPaperReceiptRequested] = useState(false);
  
  const initializedForId = useRef<string | null>(null);
  useEffect(() => {
    if (profile && initializedForId.current !== profile.id) {
      initializedForId.current = profile.id;
      setMerchantName(profile.businessName || '');
      setMerchantAddress(profile.businessAddress || '');
      setFields(configuredFields);
    }
  }, [configuredFields, profile]);

  const setField = (key: string, value: string) => setFields(current => ({ ...current, [key]: value }));
  const value = (key: string) => fields[key] ?? '';
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);
  const taxRate = Number(value('taxRate') || 0);
  const tax = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + tax;
  const paymentMethod = value('paymentMethod') || 'cash';
  const isManualCardPayment = paymentMethod === 'card-manual';
  const updateItem = (index: number, key: keyof (typeof items)[number], raw: string) => {
    const nextValue = key === 'quantity' || key === 'price' ? raw.replace(/^0+(?=\d)/, '') : raw;
    setItems(current => current.map((item, i) => i === index ? { ...item, [key]: nextValue as unknown as never } : item));
  };
  const numberOrUndefined = (key: string) => value(key).trim() ? Number(value(key)) : undefined;
  useEffect(() => {
    if (!createdReceipt || !paperReceiptRequested) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [createdReceipt, paperReceiptRequested]);
  if (createdReceipt) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 print:static print:bg-white">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-result-title"
        className="no-print w-full max-w-lg rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-lg)] md:p-8"
      >
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-primary">
          {paperReceiptRequested ? <Printer size={32} /> : <Check size={32} />}
        </span>
        <h1 id="receipt-result-title" className="mt-6 font-display text-3xl">
          {paperReceiptRequested ? 'Paper receipt ready to print' : 'Digital receipt ready'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {paperReceiptRequested
            ? 'The print dialog should open automatically. The receipt was still recorded for your sales history.'
            : 'Show this QR code to the customer so they can claim the digital receipt.'}
        </p>

        {paperReceiptRequested ? (
          <div className="mt-6">
            <div className="print-receipt-only receipt-edges mx-auto rounded-sm bg-white p-6 text-left text-[#111] shadow-[var(--shadow-md)]">
              <div className="mb-5 border-b-2 border-dashed border-[#ccc] pb-5 text-center">
                <h2 className="font-display text-xl font-bold uppercase tracking-widest">{merchantName}</h2>
                <p className="font-mono text-xs">{merchantAddress}</p>
              </div>
              <div className="mb-5 space-y-2 border-b-2 border-dashed border-[#ccc] pb-5 font-mono text-sm">
                {createdReceipt.items.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex justify-between gap-4">
                    <span>{item.quantity} × {item.name}</span>
                    <span>{money(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-b-2 border-dashed border-[#ccc] pb-5 font-mono text-sm">
                <div className="flex justify-between"><span>SUBTOTAL</span><span>{money(createdReceipt.subtotal)}</span></div>
                <div className="flex justify-between"><span>TAX</span><span>{money(createdReceipt.tax)}</span></div>
                <div className="flex justify-between pt-2 text-lg font-bold"><span>TOTAL</span><span>{money(createdReceipt.total)}</span></div>
              </div>
              <div className="mt-5 space-y-1 font-mono text-sm">
                <div className="flex justify-between"><span>{createdReceipt.paymentMethod === 'card-manual' ? 'CARD PAID' : 'CASH PAID'}</span><span>{money(createdReceipt.amountPaid ?? createdReceipt.total)}</span></div>
                {createdReceipt.changeDue != null && <div className="flex justify-between"><span>CHANGE RETURNED</span><span>{money(createdReceipt.changeDue)}</span></div>}
                {createdReceipt.approvalCode && <div className="flex justify-between"><span>APPR CODE</span><span>{createdReceipt.approvalCode}</span></div>}
              </div>
              <div className="mt-6 text-center font-mono text-xs">TC# {createdReceipt.tcCode || createdReceipt.verificationCode}</div>
            </div>
            <Button variant="outline" className="mt-5 w-full" onClick={() => window.print()}>
              <Printer size={16} /> Print again
            </Button>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-border/80 bg-background p-6">
            <div className="mx-auto w-48 rounded-2xl bg-white p-3">
              <QRCode value={JSON.stringify({
                verificationCode: createdReceipt.verificationCode,
                operatorNumber: createdReceipt.operatorNumber,
                terminalNumber: createdReceipt.terminalNumber,
                transactionNumber: createdReceipt.transactionNumber,
                tcCode: createdReceipt.tcCode,
              })} />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Claim Code</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest">{createdReceipt.verificationCode}</p>
            <Button variant="outline" className="mt-6 w-full" onClick={() => setLocation(`/receipts/${createdReceipt.id}`)}>
              View / Print receipt
            </Button>
          </div>
        )}
        <Button onClick={() => { setCreatedReceipt(null); setItems([{ ...emptyLineItem }]); setFields(configuredFields); setPaperReceiptRequested(false); }} className="mt-6 w-full">
          Start new receipt
        </Button>
      </div>
    </div>
  );
  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!merchantName.trim()) nextErrors.merchantName = 'Enter the business name shown on this receipt.';
    if (!merchantAddress.trim()) nextErrors.merchantAddress = 'Enter the business address shown on this receipt.';
    items.forEach((item, index) => {
      if (!item.name.trim()) nextErrors[`item-${index}-name`] = 'Enter an item name.';
      const quantity = Number(item.quantity);
      const price = Number(item.price);
      if (!Number.isFinite(quantity) || quantity < 1) nextErrors[`item-${index}-quantity`] = 'Quantity must be at least 1.';
      if (!Number.isFinite(price) || price < 0) nextErrors[`item-${index}-price`] = 'Enter a valid price.';
    });
    if (isManualCardPayment && !value('approvalCode').trim()) {
      nextErrors.approvalCode = 'Enter the approval code from the existing POS terminal.';
    }
    if (Object.keys(nextErrors).length) {
      setValidationErrors(nextErrors);
      return;
    }
    setValidationErrors({});
    const amountPaid = numberOrUndefined('amountPaid');
    const enteredChangeDue = numberOrUndefined('changeDue');
    const changeDue = enteredChangeDue ?? (
      amountPaid != null && amountPaid >= total
        ? Math.round((amountPaid - total) * 100) / 100
        : undefined
    );
    const data: ReceiptInput = {
      merchantName, merchantAddress, subtotal, tax, total,
      items: items.filter(item => item.name.trim()).map(item => ({ ...item, quantity: Number(item.quantity), price: Number(item.price), barcode: item.barcode || undefined, taxClass: item.taxClass || undefined })),
      storeNumber: value('storeNumber') || undefined, managerName: value('managerName') || undefined, merchantPhone: value('merchantPhone') || undefined,
      operatorNumber: value('operatorNumber') || undefined, terminalNumber: value('terminalNumber') || undefined, transactionNumber: value('transactionNumber') || undefined,
      tcCode: value('tcCode') || undefined, taxRate: numberOrUndefined('taxRate'), amountPaid, changeDue,
      paymentMethod,
      approvalCode: isManualCardPayment ? value('approvalCode').trim() : undefined,
      paperReceiptRequested,
    };
    createReceipt.mutate({ data }, { onSuccess: (receipt) => {
      setCreatedReceipt(receipt);
      void queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetBetaStatusQueryKey() });
    } });
  };
  const input = (key: string, placeholder: string, type = 'text') => {
    const numeric = type === 'number';
    return <input value={value(key)} onChange={e => { setField(key, e.target.value); setValidationErrors(current => ({ ...current, [key]: '' })); }} placeholder={placeholder} type={numeric ? 'text' : type} inputMode={numeric ? 'decimal' : undefined} pattern={numeric ? '[0-9]*[.,]?[0-9]*' : undefined} aria-invalid={Boolean(validationErrors[key])} className={`h-11 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-1 ${validationErrors[key] ? 'border-destructive bg-destructive/5 focus:border-destructive focus:ring-destructive/20' : 'border-border focus:border-primary focus:ring-primary/20'}`} data-testid={`input-${key}`} />;
  };
  return <><PageTitle eyebrow="merchant POS" title="Generate a digital receipt." description="Enter essentials quickly, or add advanced receipt details when available." action={<div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-primary"><ShieldCheck size={14} /> secure checkout</div>} /><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8">
    <div className="border-b border-border/70 pb-5"><p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">Receipt essentials</p><h2 className="mt-1 font-display text-2xl">What did they buy?</h2></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><div><input value={merchantName} onChange={e => { setMerchantName(e.target.value); setValidationErrors(current => ({ ...current, merchantName: '' })); }} placeholder="Business name" aria-invalid={Boolean(validationErrors.merchantName)} className={`h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-1 ${validationErrors.merchantName ? 'border-destructive bg-destructive/5 focus:border-destructive focus:ring-destructive/20' : 'border-border focus:border-primary focus:ring-primary/20'}`} />{validationErrors.merchantName && <p className="mt-1 text-xs text-destructive">{validationErrors.merchantName}</p>}</div><div><input value={merchantAddress} onChange={e => { setMerchantAddress(e.target.value); setValidationErrors(current => ({ ...current, merchantAddress: '' })); }} placeholder="Business address" aria-invalid={Boolean(validationErrors.merchantAddress)} className={`h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-1 ${validationErrors.merchantAddress ? 'border-destructive bg-destructive/5 focus:border-destructive focus:ring-destructive/20' : 'border-border focus:border-primary focus:ring-primary/20'}`} />{validationErrors.merchantAddress && <p className="mt-1 text-xs text-destructive">{validationErrors.merchantAddress}</p>}</div></div>
    <div className="mt-5 space-y-3">{items.map((item, i) => <div key={i} className="rounded-xl border border-border/70 p-3"><div className="grid grid-cols-[1fr_62px_82px_34px] gap-2"><input value={item.name} onChange={e => { updateItem(i, 'name', e.target.value); setValidationErrors(current => ({ ...current, [`item-${i}-name`]: '' })); }} placeholder="Item name" aria-invalid={Boolean(validationErrors[`item-${i}-name`])} className={`h-10 min-w-0 rounded-lg border bg-background px-2 text-sm ${validationErrors[`item-${i}-name`] ? 'border-destructive bg-destructive/5' : 'border-border'}`} /><input value={item.quantity} onChange={e => { updateItem(i, 'quantity', e.target.value); setValidationErrors(current => ({ ...current, [`item-${i}-quantity`]: '' })); }} type="number" min="1" aria-invalid={Boolean(validationErrors[`item-${i}-quantity`])} className={`h-10 rounded-lg border bg-background px-2 text-center text-sm ${validationErrors[`item-${i}-quantity`] ? 'border-destructive bg-destructive/5' : 'border-border'}`} /><input value={item.price} onChange={e => { updateItem(i, 'price', e.target.value); setValidationErrors(current => ({ ...current, [`item-${i}-price`]: '' })); }} type="number" min="0" step=".01" aria-invalid={Boolean(validationErrors[`item-${i}-price`])} className={`h-10 rounded-lg border bg-background px-2 text-right text-sm ${validationErrors[`item-${i}-price`] ? 'border-destructive bg-destructive/5' : 'border-border'}`} /><button onClick={() => setItems(current => current.length > 1 ? current.filter((_, index) => index !== i) : current)} className="grid h-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><Minus size={15} /></button></div>{(validationErrors[`item-${i}-name`] || validationErrors[`item-${i}-quantity`] || validationErrors[`item-${i}-price`]) && <p className="mt-1 text-xs text-destructive">{validationErrors[`item-${i}-name`] || validationErrors[`item-${i}-quantity`] || validationErrors[`item-${i}-price`]}</p>}<div className="mt-2 grid gap-2 sm:grid-cols-2"><input value={item.barcode} onChange={e => updateItem(i, 'barcode', e.target.value)} placeholder="Barcode (optional)" className="h-9 rounded-lg border border-border bg-background px-2 text-xs" /><input value={item.taxClass} onChange={e => updateItem(i, 'taxClass', e.target.value)} placeholder="Tax class (optional)" className="h-9 rounded-lg border border-border bg-background px-2 text-xs" /></div></div>)}</div>
    <Button variant="soft" className="mt-4 min-h-9 px-3 text-xs" onClick={() => setItems(current => [...current, { name: '', quantity: 1, price: 0, barcode: '', taxClass: '' }])}><Plus size={14} /> Add line item</Button>
    <div className="mt-8 border-t border-border/70 pt-6"><p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">Store & transaction details</p><p className="mt-1 text-xs text-muted-foreground">Optional fields do not block the fast path.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{input('storeNumber', 'Store number')}{input('managerName', 'Manager name')}{input('merchantPhone', 'Merchant phone', 'tel')}{input('operatorNumber', 'Operator number')}{input('terminalNumber', 'Terminal number')}{input('transactionNumber', 'Transaction number')}{input('tcCode', 'TC code')}</div></div>
     <div className="mt-8 border-t border-border/70 pt-6">
       <p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">Payment details</p>
       <div className="mt-4 grid gap-3 sm:grid-cols-2">
         <label className="flex flex-col gap-2 text-sm">
           <span className="font-semibold">Payment record</span>
           <select value={paymentMethod} onChange={e => setField('paymentMethod', e.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20" data-testid="select-payment-method">
             <option value="cash">Cash paid</option>
              <option value="card-manual">CREDIT CARD — Manual Tracking</option>
           </select>
         </label>
         {input('amountPaid', 'Amount paid', 'number')}
         {input('changeDue', 'Change due', 'number')}
         {isManualCardPayment && input('approvalCode', 'Approval code from existing POS', 'text')}
         {input('taxRate', 'Local sales tax rate (%)', 'number')}
       </div>
       {isManualCardPayment ? (
         <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs leading-5 text-foreground">
           <strong>Manual payment record only.</strong> The customer already paid on your existing POS terminal. FUTURERECEİPT does not charge cards, connect to a payment processor, or handle payment funds.
         </div>
       ) : (
         <p className="mt-3 text-xs text-muted-foreground">Cash payment records only. FUTURERECEİPT generates and tracks the digital receipt.</p>
       )}
     </div>
     <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold">Automatic sales tax</span><strong className="font-mono">{money(tax)}</strong></div><p className="mt-1 text-xs text-muted-foreground">Calculated from subtotal at the store&apos;s configured local rate of {String(taxRate)}%.</p></div>
  </section><aside className="h-fit rounded-2xl bg-primary p-7 text-primary-foreground lg:sticky lg:top-24"><p className="text-xs font-bold uppercase tracking-[.13em] text-primary-foreground/60">receipt preview</p><div className="mt-5 rounded-2xl bg-[#f5f1e8] p-5 text-foreground"><p className="font-display text-xl">{merchantName || 'Your business'}</p><p className="text-xs text-muted-foreground">{merchantAddress || 'Business address'}</p><div className="my-5 space-y-3 text-sm">{items.filter(item => item.name).map((item, i) => <div className="flex justify-between" key={i}><span>{item.quantity} × {item.name}</span><span>{money(item.quantity * item.price)}</span></div>)}</div><div className="space-y-2 border-t border-border pt-4 text-sm"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{money(tax)}</span></div><div className="flex justify-between pt-2 text-lg font-bold"><span>Total</span><span>{money(total)}</span></div></div></div><Button className="mt-5 w-full bg-accent text-[#3d2115] hover:bg-accent/90" onClick={submit} disabled={createReceipt.isPending}>{createReceipt.isPending ? 'Generating…' : <><QrCode size={16} /> Generate claim code</>}</Button>{createReceipt.isError && <p className="mt-3 text-sm text-red-100">The receipt could not be generated. Review the highlighted fields and try again.</p>}</aside></div></>;
}

 function BadgeItem({ icon: Icon, title, unlocked, progress }: { icon: typeof Leaf, title: string, unlocked: boolean, progress: string }) {
  return (
    <div className={`relative flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all ${unlocked ? 'border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 to-transparent shadow-sm' : 'border-border/50 bg-secondary/10'}`}>
      <div className="relative">
         {/* Ribbon */}
         <div className={`mx-auto h-3 w-4 rounded-t-sm ${unlocked ? 'bg-red-500' : 'bg-muted'}`} />
         {/* Medal */}
         <div className={`relative grid h-12 w-12 place-items-center rounded-full border-[3px] shadow-sm ${unlocked ? 'border-yellow-400 bg-yellow-100 text-yellow-700' : 'border-border bg-muted text-muted-foreground'}`}>
            {unlocked ? <Icon size={20} /> : <Lock size={18} />}
            {unlocked && (
              <div className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm border border-yellow-200">
                <Check size={10} className="text-yellow-600" />
              </div>
            )}
         </div>
      </div>
      <p className={`mt-3 text-xs font-bold leading-tight ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>{title}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{progress}</p>
    </div>
  );
}

function Profile() {
  const query = useGetProfile();
  const save = useSaveProfile();
  const impactQuery = useGetImpactSummary();
  const p = query.data;
  const impact = impactQuery.data;
  
  const [role, setRole] = useState<'customer' | 'merchant'>(p?.role ?? 'customer');
  const [name, setName] = useState(p?.name ?? '');
  const [email, setEmail] = useState(p?.email ?? '');
  const [phone, setPhone] = useState(p?.phone ?? '');
  
  const [monthlyBudget, setMonthlyBudget] = useState(p?.monthlyBudget?.toString() ?? '');
  const [weeklyEmailReport, setWeeklyEmailReport] = useState(p?.weeklyEmailReport ?? false);
  const [treeHealthNotifications, setTreeHealthNotifications] = useState(p?.treeHealthNotifications ?? false);
  const [privacyMode, setPrivacyMode] = useState<'private' | 'anonymous-research'>(p?.privacyMode ?? 'private');

  const [businessName, setBusinessName] = useState(p?.businessName ?? '');
  const [storeNumber, setStoreNumber] = useState(p?.storeNumber ?? '');
  const [managerName, setManagerName] = useState(p?.managerName ?? '');
  const [merchantCategory, setMerchantCategory] = useState(p?.merchantCategory ?? '');
  const [businessEin, setBusinessEin] = useState(p?.businessEin ?? '');
  const [businessAddress, setBusinessAddress] = useState(p?.businessAddress ?? '');
  const [salesTaxId, setSalesTaxId] = useState(p?.salesTaxId ?? '');
  const [operatorNumber, setOperatorNumber] = useState(p?.operatorNumber ?? '');
  const [terminalNumber, setTerminalNumber] = useState(p?.terminalNumber ?? '');
  const [transactionNumber, setTransactionNumber] = useState(p?.transactionNumber ?? '');
  const [tcCode, setTcCode] = useState(p?.tcCode ?? '');
  const [taxRate, setTaxRate] = useState(p?.taxRate == null ? '' : String(p.taxRate));
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const [copied, setCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteShared, setInviteShared] = useState(false);
  
  // Delete account state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const deleteAccount = useDeleteAccount();
  const { signOut } = useClerk();

  useEffect(() => {
    if (!p) return;
    setRole(p.role);
    setName(p.name);
    setEmail(p.email);
    setPhone(p.phone ?? '');
    setMonthlyBudget(p.monthlyBudget?.toString() ?? '');
    setWeeklyEmailReport(p.weeklyEmailReport ?? false);
    setTreeHealthNotifications(p.treeHealthNotifications ?? false);
    setPrivacyMode(p.privacyMode ?? 'private');
    setBusinessName(p.businessName ?? '');
    setStoreNumber(p.storeNumber ?? '');
    setManagerName(p.managerName ?? '');
    setMerchantCategory(p.merchantCategory ?? '');
    setBusinessEin(p.businessEin ?? '');
    setBusinessAddress(p.businessAddress ?? '');
    setSalesTaxId(p.salesTaxId ?? '');
    setOperatorNumber(p.operatorNumber ?? '');
    setTerminalNumber(p.terminalNumber ?? '');
    setTransactionNumber(p.transactionNumber ?? '');
    setTcCode(p.tcCode ?? '');
    setTaxRate(p.taxRate == null ? '' : String(p.taxRate));
  }, [p]);

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Enter a display name.';
    if (!email.trim()) nextErrors.email = 'Enter an email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email address.';
    if (monthlyBudget && (!Number.isFinite(Number(monthlyBudget)) || Number(monthlyBudget) < 0)) nextErrors['monthly-budget'] = 'Enter a valid amount of $0 or more.';
    if (role === 'merchant' && !businessName.trim()) nextErrors['business-name'] = 'Enter your business name.';
    if (role === 'merchant' && taxRate && (!Number.isFinite(Number(taxRate)) || Number(taxRate) < 0 || Number(taxRate) > 100)) nextErrors['tax-rate'] = 'Enter a tax rate between 0 and 100.';
    if (Object.keys(nextErrors).length) {
      setValidationErrors(nextErrors);
      return;
    }
    setValidationErrors({});
    save.mutate({ 
    data: { 
      role, 
      name, 
      email, 
      phone: phone || undefined,
      monthlyBudget: monthlyBudget ? Number(monthlyBudget) : undefined,
      weeklyEmailReport,
      treeHealthNotifications,
      privacyMode,
      businessName: role === 'merchant' ? businessName : undefined, 
      storeNumber: role === 'merchant' ? storeNumber : undefined,
      managerName: role === 'merchant' ? managerName : undefined,
      merchantCategory: role === 'merchant' ? merchantCategory : undefined,
      businessEin: role === 'merchant' ? businessEin : undefined, 
      businessAddress: role === 'merchant' ? businessAddress : undefined, 
      salesTaxId: role === 'merchant' ? salesTaxId : undefined,
      operatorNumber: role === 'merchant' ? operatorNumber : undefined,
      terminalNumber: role === 'merchant' ? terminalNumber : undefined,
      transactionNumber: role === 'merchant' ? transactionNumber : undefined,
      tcCode: role === 'merchant' ? tcCode : undefined,
      taxRate: role === 'merchant' && taxRate ? Number(taxRate) : undefined,
    } 
    });
  };

  const handleCopyId = () => {
    if (!p?.ecobillId) return;
    navigator.clipboard.writeText(p.ecobillId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDelete = () => {
    setDeleteError('');
    if (deleteConfirmText !== 'DELETE') return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => signOut({ redirectUrl: '/' }),
      onError: () => setDeleteError('Could not delete account. Please try again or contact support.')
    });
  };

  const handleShareInvite = async () => {
    if (!p?.inviteCode) return;
    const url = `${window.location.origin}${basePath}/?ref=${p.inviteCode}`;
    const shareData = {
      title: 'Join me on FUTURERECEİPT',
      text: 'Goodbye paper receipts, hello green future. Join me on FUTURERECEİPT!',
      url,
    };
    
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        setInviteShared(true);
        setTimeout(() => setInviteShared(false), 2000);
      } else {
        await navigator.clipboard.writeText(url);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(url);
          setInviteCopied(true);
          setTimeout(() => setInviteCopied(false), 2000);
        } catch (e) {
          // ignore
        }
      }
    }
  };

  const handleCopyInvite = async () => {
    if (!p?.inviteCode) return;
    const url = `${window.location.origin}${basePath}/?ref=${p.inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch (e) {
      // ignore
    }
  };

  const stageToLevel: Record<string, number> = { seed: 1, sprout: 2, sapling: 3, tree: 4, forest: 5 };
  const currentLevel = impact ? stageToLevel[impact.treeStage] || 1 : 1;

  return (
    <>
      <PageTitle 
        eyebrow={role === 'merchant' ? "Store Config" : "account"} 
        title={role === 'merchant' ? "Store Identity & Config." : "Your profile, your details."} 
        description={role === 'merchant' ? "Manage your FUTURERECEİPT store credentials and preferences." : "Keep your FUTURERECEİPT identity and information up to date."}
        action={<Pill tone="orange">Beta v0.9</Pill>}
      />

      {/* Avatar & Identity Hierarchy */}
      <div className="mb-10 flex flex-col items-center justify-center text-center animate-fade">
        <div className="relative grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-primary to-[#183b2a] text-5xl font-bold text-white shadow-xl">
          {(name || 'E').slice(0, 1).toUpperCase()}
        </div>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-.02em]">{name || 'Your profile'}</h1>
        
        {role === 'customer' && impact && (
          <div className="mt-3 flex items-center justify-center gap-4 text-sm">
             <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
               <Sparkles size={14} /> Level {currentLevel} {impact.treeStage}
             </span>
             <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
               <TreePine size={15} className="text-accent" /> {impact.treesSaved} trees saved
             </span>
          </div>
        )}
      </div>

      {role === 'customer' && impact && (
        <div className="mb-8 grid gap-8 lg:grid-cols-2">
          {/* Eco Career Hero (Rebalanced without top-level Rank, showing details instead) */}
          <section className="rounded-3xl border border-border/80 bg-card shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="bg-primary px-8 py-6 text-primary-foreground relative overflow-hidden">
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <Pill tone="orange">Forest Status</Pill>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <h2 className="font-display text-3xl font-semibold tracking-[-.02em]">Growing</h2>
                  <p className="text-primary-foreground/80 font-medium mt-1">Sustaining your impact</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold">{impact.ecoPoints}</p>
                  <p className="text-xs uppercase tracking-widest text-primary-foreground/70 mt-1">Points</p>
                </div>
              </div>
            </div>
            <div className="bg-card p-6 px-8">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Streak</p>
                    <p className="font-mono text-lg font-bold">{impact.currentStreak} <span className="text-xs text-muted-foreground font-sans">days</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tree Health</p>
                    <p className="font-medium capitalize text-foreground flex items-center gap-1.5 mt-0.5">
                      <span className={`h-2 w-2 rounded-full ${impact.treeHealth === 'thriving' ? 'bg-primary' : impact.treeHealth === 'wilting' ? 'bg-orange-500' : 'bg-muted-foreground'}`} />
                      {impact.treeHealth}
                    </p>
                  </div>
               </div>
            </div>
          </section>

          {/* Badges Section */}
          <section className="rounded-3xl border border-border/80 bg-card shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="border-b border-border/70 p-6 pb-4 md:px-8">
              <h3 className="font-display text-2xl">Eco-Badges</h3>
              <p className="mt-1 text-sm text-muted-foreground">Your achievements in reducing waste.</p>
            </div>
            <div className="p-6 md:px-8 grid gap-4 grid-cols-1 sm:grid-cols-3">
              <BadgeItem 
                 icon={ReceiptText} 
                 title="First Digital" 
                 unlocked={impact.digitalOnlyReceipts >= 1} 
                 progress={impact.digitalOnlyReceipts >= 1 ? 'Unlocked' : `${impact.digitalOnlyReceipts}/1 Receipts`} 
              />
              <BadgeItem 
                 icon={Zap} 
                 title="7-Day Streak" 
                 unlocked={impact.currentStreak >= 7 || impact.longestStreak >= 7} 
                 progress={impact.currentStreak >= 7 || impact.longestStreak >= 7 ? 'Unlocked' : `${Math.max(impact.currentStreak, impact.longestStreak)}/7 Days`} 
              />
              <BadgeItem 
                 icon={Droplets} 
                 title="100L Water" 
                 unlocked={impact.waterSavedLiters >= 100} 
                 progress={impact.waterSavedLiters >= 100 ? 'Unlocked' : `${Math.floor(impact.waterSavedLiters)}/100 L`} 
              />
            </div>
          </section>
        </div>
      )}

      {role === 'customer' && p?.inviteCode && (
        <section className="mb-8 rounded-3xl border border-border/80 bg-[#f7f9f5] p-6 shadow-[var(--shadow-sm)] md:p-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/5 blur-3xl" />
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                  <Users size={16} />
                </span>
                 <p className="text-sm font-bold uppercase tracking-widest text-primary">Grow the FUTURERECEİPT community</p>
              </div>
              <h3 className="font-display text-3xl mt-3">Invite Friends</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-md">
                 A successful invite is counted after a new user creates their first FUTURERECEİPT account through your link.
              </p>
              
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button 
                  onClick={handleShareInvite}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
                  data-testid="button-share-invite"
                >
                  {inviteShared ? <Check size={16} /> : <Share size={16} />}
                  {inviteShared ? 'Shared!' : 'Share Invite'}
                </button>
                <button 
                  onClick={handleCopyInvite}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold text-foreground transition hover:bg-secondary/50"
                  data-testid="button-copy-invite-link"
                >
                  {inviteCopied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
                  {inviteCopied ? 'Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
            
            <div className="grid gap-3 shrink-0 min-w-[240px]">
              <div className="rounded-2xl border border-border/50 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Your Invite Code</p>
                <p className="font-mono text-xl font-bold tracking-wider text-foreground" data-testid="text-invite-code">
                  {p.inviteCode}
                </p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-white p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Successful Invites</p>
                  <p className="font-display text-2xl font-bold text-primary" data-testid="text-referral-count">
                    {p.referralCount ?? 0}
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                  <Award size={20} />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {role === 'merchant' && (
        <section className="mb-8 rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8" data-testid="section-merchant-identity">
          <div className="mb-6 border-b border-border/70 pb-4">
            <p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">Store Config</p>
            <h3 className="mt-1 font-display text-2xl">Store Identity</h3>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Merchant Name" value={businessName} onChange={setBusinessName} id="business-name" description="Required. Appears on receipts." error={validationErrors['business-name']} />
            <Field label="Store Number / ST #" value={storeNumber} onChange={setStoreNumber} id="store-number" description="Optional internal ID." />
            <Field label="Store Manager / Mgr" value={managerName} onChange={setManagerName} id="manager-name" />
            
            <label className="block">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Business Category</span>
              </div>
              <input 
                list="merchant-categories" 
                value={merchantCategory} 
                onChange={e => setMerchantCategory(e.target.value)} 
                id="merchant-category" 
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20" 
                placeholder="e.g. Supermarket / Groceries"
                data-testid="input-merchant-category"
              />
              <datalist id="merchant-categories">
                <option value="Supermarket / Groceries" />
                <option value="Cafe / Coffee Shop" />
                <option value="Restaurant" />
                <option value="Retail / Apparel" />
                <option value="Hardware / DIY" />
                <option value="Salon / Barbershop" />
              </datalist>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Helps categorize purchases for your customers.</p>
            </label>
          </div>
          <div className="mt-8 border-t border-border/70 pt-6">
            <p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">Terminal Data</p>
            <h4 className="mt-1 font-display text-xl">Register & POS defaults</h4>
            <p className="mt-1 text-sm text-muted-foreground">Automatically applied to every new receipt and included in the claim QR payload.</p>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <Field label="Operator Number / OP #" value={operatorNumber} onChange={setOperatorNumber} id="operator-number" />
              <Field label="Terminal Number / TE #" value={terminalNumber} onChange={setTerminalNumber} id="terminal-number" />
              <Field label="Transaction Number / TR #" value={transactionNumber} onChange={setTransactionNumber} id="transaction-number" />
              <Field label="TC Code / TC #" value={tcCode} onChange={setTcCode} id="tc-code" />
              <Field label="Local Sales Tax Rate (%)" value={taxRate} onChange={setTaxRate} id="tax-rate" type="number" min={0} max={100} step="0.001" description="The United States has no federal VAT. Enter the combined state, county, city, and district rate for this store. It is used automatically by the POS." error={validationErrors['tax-rate']} />
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_.6fr]">
        
        {/* Left Column: Editable Information */}
        <div className="flex flex-col gap-8">
          
          <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8">
            <div className="mb-6 border-b border-border/70 pb-4">
              <h3 className="font-display text-2xl">Basic Account Information</h3>
               <p className="mt-1 text-sm text-muted-foreground">Manage your identity inside FUTURERECEİPT.</p>
            </div>
            
            <div className="grid gap-6">
              <Field 
                label="Display Name" 
                value={name} 
                onChange={setName} 
                id="name" 
                 description="This is how you appear inside FUTURERECEİPT and on future eco-score leaderboards."
                error={validationErrors.name}
              />
              <Field 
                label="Email address" 
                value={email} 
                onChange={setEmail} 
                id="email" 
                type="email" 
                description="Used for account recovery and sending digital receipt summaries." 
                error={validationErrors.email}
              />
              <Field 
                label="Optional Phone Number" 
                value={phone} 
                onChange={setPhone} 
                id="phone" 
                type="tel"
                optional
                description="Stored only as an opt-in contact for future SMS coupons or 2FA. (Does not currently enable SMS or 2FA)." 
              />
            </div>
          </section>

          <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8">
            <div className="mb-6 border-b border-border/70 pb-4">
              <h3 className="font-display text-2xl">Spending & Notification Preferences</h3>
              <p className="mt-1 text-sm text-muted-foreground">Control how you track and hear about your impact.</p>
            </div>
            
            <div className="grid gap-8">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Monthly Spending Target</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-muted-foreground">$</span>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    value={monthlyBudget} 
                    onChange={e => setMonthlyBudget(e.target.value)} 
                    aria-invalid={Boolean(validationErrors['monthly-budget'])}
                    className={`h-11 w-full rounded-xl border bg-background pl-8 pr-4 text-sm outline-none transition focus:ring-1 ${validationErrors['monthly-budget'] ? 'border-destructive bg-destructive/5 focus:border-destructive focus:ring-destructive/20' : 'border-border focus:border-primary focus:ring-primary/20'}`} 
                    placeholder="e.g. 400.00"
                    data-testid="input-monthly-budget"
                  />
                  {validationErrors['monthly-budget'] && <p className="mt-2 text-[13px] text-destructive">{validationErrors['monthly-budget']}</p>}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  A personal target to monitor your spending (e.g. $400). This is a personal goal, not a payment or card limit.
                </p>
              </div>

              <div className="h-px w-full bg-border/50" />

              <label className="flex cursor-pointer items-start gap-4">
                <div className="mt-0.5 flex shrink-0 items-center justify-center">
                  <input type="checkbox" className="peer sr-only" checked={weeklyEmailReport} onChange={e => setWeeklyEmailReport(e.target.checked)} data-testid="checkbox-weekly-email" />
                  <div className="h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-primary after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4 relative" />
                </div>
                <div>
                  <span className="block text-sm font-semibold text-foreground">Weekly Email Spending Analysis</span>
                   <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">Receive a summary of your FUTURERECEİPT purchases and category trends every week.</span>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-4">
                <div className="mt-0.5 flex shrink-0 items-center justify-center">
                  <input type="checkbox" className="peer sr-only" checked={treeHealthNotifications} onChange={e => setTreeHealthNotifications(e.target.checked)} data-testid="checkbox-tree-health" />
                  <div className="h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-primary after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4 relative" />
                </div>
                <div>
                  <span className="block text-sm font-semibold text-foreground">Tree Health Alerts</span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">Get notified when your streak drops or your virtual tree's health changes.</span>
                </div>
              </label>

              <div className="rounded-xl bg-secondary/40 p-4 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex gap-2 items-center">
                <BellRing size={14} />
                Note: Delivery activates when the notification service is enabled.
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8">
            <div className="mb-6 border-b border-border/70 pb-4">
              <h3 className="font-display text-2xl">App Role</h3>
              <p className="mt-1 text-sm text-muted-foreground">Switch between buying and selling modes.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <button onClick={() => setRole('customer')} className={`flex flex-col rounded-2xl border p-5 text-left transition hover:border-primary/50 hover:bg-secondary/30 ${role === 'customer' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card'}`} data-testid="button-role-customer">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <UserRound size={20} />
                </span>
                <p className="mt-4 font-bold text-foreground">Customer</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Keep your receipts and understand your spending.</p>
              </button>
              <button onClick={() => setRole('merchant')} className={`flex flex-col rounded-2xl border p-5 text-left transition hover:border-primary/50 hover:bg-secondary/30 ${role === 'merchant' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card'}`} data-testid="button-role-merchant">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Building2 size={20} />
                </span>
                <p className="mt-4 font-bold text-foreground">Merchant</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Issue digital receipts and report your impact.</p>
              </button>
            </div>
          </section>

          {role === 'merchant' && (
            <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8">
              <div className="mb-6 border-b border-border/70 pb-4">
                <p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">Legal & Tax</p>
                <h3 className="mt-1 font-display text-2xl">Business Details</h3>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="EIN" value={businessEin} onChange={setBusinessEin} id="business-ein" />
                <Field label="Sales tax ID" value={salesTaxId} onChange={setSalesTaxId} id="sales-tax-id" />
                <div className="sm:col-span-2">
                  <Field label="Business address" value={businessAddress} onChange={setBusinessAddress} id="business-address" />
                </div>
              </div>
            </section>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:px-8">
            <div className="text-sm font-medium text-muted-foreground">
              {save.isSuccess ? (
                <span className="flex items-center gap-2 text-primary"><Check size={16} /> Saved successfully.</span>
              ) : save.isError ? (
                <span className="flex items-center gap-2 text-destructive"><AlertTriangle size={16} /> Error saving changes.</span>
              ) : 'Changes are private to your account.'}
            </div>
            <Button onClick={submit} disabled={save.isPending} data-testid="button-save-profile">
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
          
        </div>

        {/* Right Column: Account Security & ID */}
        <div className="flex flex-col gap-8">
          <section className="rounded-3xl border border-border/80 bg-card shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="border-b border-border/70 p-6 pb-4 md:px-8">
              <h3 className="font-display text-2xl">Account Security</h3>
               <p className="mt-1 text-sm text-muted-foreground">Your FUTURERECEİPT identifiers.</p>
            </div>
            
            <div className="p-6 md:p-8">
              {/* Eco-ID Card */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#183b2a] p-1 shadow-lg transition-transform hover:-translate-y-1">
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                
                <div className="relative flex h-full flex-col justify-between rounded-[1.1rem] bg-primary/20 border border-white/10 p-6 backdrop-blur-md">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                        <ShieldCheck size={12} />
                        Eco-ID
                      </div>
                      <p className="mt-2 text-xs font-medium text-primary-foreground/70">Unique Identifier • Not editable</p>
                    </div>
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-xl font-bold text-primary-foreground shadow-inner">
                      {(name || 'E').slice(0, 1).toUpperCase()}
                    </div>
                  </div>
                  
                  <div className="mt-10">
                    <p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary-foreground/50">
                      {p?.role === 'merchant' ? 'Merchant Code' : 'Customer Code'}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="font-mono text-xl font-bold tracking-wider text-primary-foreground break-all" data-testid="text-ecobill-id">
                        {p?.ecobillId ?? '—'}
                      </p>
                      <button 
                        onClick={handleCopyId}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-primary-foreground transition hover:bg-white/25 hover:text-white"
                        aria-label="Copy Eco-ID"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-border/50 bg-secondary/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-primary"><QrCode size={18} /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Checkout Ready</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      This ID is uniquely yours. It is ready for future checkout QR linking across participating merchants.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </section>
        </div>
      </div>

      {/* Bottom Section: Data Privacy & Danger Zone */}
      <div className="mt-8 flex flex-col gap-8">
        
        {/* Data Privacy Section */}
        <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8">
          <div className="mb-6 border-b border-border/70 pb-4">
            <h3 className="font-display text-2xl">Data Privacy</h3>
            <p className="mt-1 text-sm text-muted-foreground">Manage how your receipt data is utilized.</p>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={`relative flex cursor-pointer flex-col rounded-2xl border p-5 transition hover:border-primary/50 hover:bg-secondary/30 ${privacyMode === 'private' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card'}`}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-foreground">Keep my data completely private</p>
                <div className={`grid h-5 w-5 place-items-center rounded-full border ${privacyMode === 'private' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                  {privacyMode === 'private' && <div className="h-2 w-2 rounded-full bg-current" />}
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Your receipts remain entirely private and are never included in aggregate research datasets.</p>
              <input 
                type="radio" 
                name="privacyMode" 
                className="sr-only" 
                checked={privacyMode === 'private'} 
                onChange={() => setPrivacyMode('private')}
                data-testid="radio-privacy-private" 
              />
            </label>

            <label className={`relative flex cursor-pointer flex-col rounded-2xl border p-5 transition hover:border-primary/50 hover:bg-secondary/30 ${privacyMode === 'anonymous-research' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card'}`}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-foreground">Allow anonymous data for market research</p>
                <div className={`grid h-5 w-5 place-items-center rounded-full border ${privacyMode === 'anonymous-research' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                  {privacyMode === 'anonymous-research' && <div className="h-2 w-2 rounded-full bg-current" />}
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Help advance sustainable commerce. Consent is optional, and personally identifying details are never included.</p>
              <input 
                type="radio" 
                name="privacyMode" 
                className="sr-only" 
                checked={privacyMode === 'anonymous-research'} 
                onChange={() => setPrivacyMode('anonymous-research')}
                data-testid="radio-privacy-research" 
              />
            </label>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6 md:p-8">
          <div className="mb-6 flex items-start gap-4 border-b border-destructive/20 pb-4">
            <div className="rounded-xl bg-destructive/10 p-2 text-destructive">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-display text-2xl text-destructive">Danger Zone</h3>
              <p className="mt-1 text-sm text-destructive/80">Permanent and irreversible actions.</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-foreground">Delete Account</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                Permanently delete your profile, preferences, and streak activity. 
                Transaction receipts required as merchant records are retained, but your identity is unlinked and anonymized.
              </p>
            </div>
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-destructive bg-destructive/10 px-6 text-sm font-bold text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
              data-testid="button-open-delete"
            >
              <Trash2 size={16} /> Delete Account
            </button>
          </div>
        </section>

      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm animate-fade">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-destructive/10 p-3 text-destructive">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-display text-2xl text-foreground">Delete Account</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  This action is irreversible. Your identity access, streaks, and preferences will be permanently wiped.
                </p>
              </div>
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-semibold text-foreground mb-2">
                Type <strong className="text-destructive font-mono bg-destructive/10 px-1 rounded">DELETE</strong> to confirm
              </label>
              <input 
                type="text" 
                value={deleteConfirmText} 
                onChange={(e) => setDeleteConfirmText(e.target.value)} 
                className="h-11 w-full rounded-xl border border-destructive/40 bg-background px-3 font-mono text-sm outline-none transition focus:border-destructive focus:ring-1 focus:ring-destructive/20"
                placeholder="DELETE"
                data-testid="input-confirm-delete"
                autoFocus
              />
              {deleteError && (
                <p className="mt-2 text-sm text-destructive">{deleteError}</p>
              )}
            </div>
            
            <div className="mt-8 flex items-center justify-end gap-3">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={deleteConfirmText !== 'DELETE' || deleteAccount.isPending}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-destructive px-5 text-sm font-bold text-destructive-foreground transition disabled:opacity-50 hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteAccount.isPending ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, id, type = 'text', description, optional, error, min, max, step }: { label: string; value: string; onChange: (value: string) => void; id: string; type?: string; description?: ReactNode; optional?: boolean; error?: string; min?: number; max?: number; step?: number | string }) { 
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {optional && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Optional
          </span>
        )}
      </div>
      <input 
        id={id} 
        type={type} 
        value={value} 
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(e.target.value)} 
        aria-invalid={Boolean(error)}
        className={`h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal text-foreground outline-none transition focus:ring-1 ${error ? 'border-destructive bg-destructive/5 focus:border-destructive focus:ring-destructive/20' : 'border-border focus:border-primary focus:ring-primary/20'}`} 
        data-testid={`input-${id}`} 
      />
      {error && <span className="mt-2 block text-[13px] leading-relaxed text-destructive">{error}</span>}
      {description && (
        <span className="mt-2 block text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </span>
      )}
    </label>
  ); 
}

function Onboarding() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const save = useSaveProfile();
  const [role, setRole] = useState<'customer' | 'merchant'>('customer');
  const [name, setName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress || '');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    const userName = user?.fullName?.trim();
    const userEmail = user?.primaryEmailAddress?.emailAddress?.trim();
    if (userName) setName(current => current.trim() ? current : userName);
    if (userEmail) setEmail(current => current.trim() ? current : userEmail);
  }, [user?.id, user?.fullName, user?.primaryEmailAddress?.emailAddress]);
  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Enter your name.';
    if (!email.trim()) nextErrors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email address.';
    if (role === 'merchant' && !businessName.trim()) nextErrors.businessName = 'Enter your business name.';
    if (Object.keys(nextErrors).length) { setValidationErrors(nextErrors); return; }
    setValidationErrors({});
    save.mutate({ data: { role, name, email, businessName: role === 'merchant' ? businessName : undefined, businessAddress: role === 'merchant' ? businessAddress : undefined } }, { onSuccess: () => setLocation('/dashboard') });
  };
  return <div className="ecobill-noise min-h-[100dvh] bg-[#eeeadf] px-5 py-8 md:px-10"><Logo /><div className="mx-auto max-w-3xl py-14"><Pill>first, a quick hello</Pill><h1 className="mt-5 max-w-2xl font-display text-5xl tracking-[-.06em] md:text-7xl">Let's make your receipts feel <em className="text-primary not-italic">better.</em></h1><p className="mt-5 max-w-lg text-lg leading-7 text-muted-foreground">Tell us how you'll use FUTURERECEİPT. You can change this anytime.</p><div className="mt-10 grid gap-4 md:grid-cols-2"><button onClick={() => setRole('customer')} className={`rounded-3xl border p-6 text-left transition ${role === 'customer' ? 'border-primary bg-card shadow-[var(--shadow-md)]' : 'border-border bg-card/40'}`} data-testid="button-onboarding-customer"><UserRound className="text-primary" /><h2 className="mt-16 font-display text-3xl">I'm shopping</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Keep every receipt, understand your habits, save a little paper.</p></button><button onClick={() => setRole('merchant')} className={`rounded-3xl border p-6 text-left transition ${role === 'merchant' ? 'border-primary bg-card shadow-[var(--shadow-md)]' : 'border-border bg-card/40'}`} data-testid="button-onboarding-merchant"><Building2 className="text-accent" /><h2 className="mt-16 font-display text-3xl">I'm selling</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Give customers a receipt they can trust and track your impact.</p></button></div><div className="mt-6 rounded-2xl border border-border bg-card p-6"><div className="grid gap-5 sm:grid-cols-2"><Field label="Your name" value={name} onChange={setName} id="onboarding-name" error={validationErrors.name} /><Field label="Email" value={email} onChange={setEmail} id="onboarding-email" error={validationErrors.email} /></div>{role === 'merchant' && <div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Business name" value={businessName} onChange={setBusinessName} id="onboarding-business-name" error={validationErrors.businessName} /><Field label="Business address" value={businessAddress} onChange={setBusinessAddress} id="onboarding-business-address" /></div>}<div className="mt-7 flex justify-end"><Button onClick={submit} disabled={save.isPending} data-testid="button-complete-onboarding">{save.isPending ? 'Creating your space…' : <>Continue to FUTURERECEİPT <ArrowRight size={16} /></>}</Button></div></div></div></div>;
}

type DetectedBarcode = { rawValue?: string };
type NativeBarcodeDetector = {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
};
type NativeBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => NativeBarcodeDetector;

function verificationCodeFromQr(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) return '';

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null && 'verificationCode' in parsed) {
      const verificationCode = (parsed as { verificationCode?: unknown }).verificationCode;
      return typeof verificationCode === 'string' ? verificationCode.trim() : '';
    }
  } catch {
    // Older merchant screens may encode the verification code as plain text.
  }

  return value;
}

function ScanReceipt() {
  const [, setLocation] = useLocation();
  const claim = useClaimReceipt();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<NativeBarcodeDetector | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanActiveRef = useRef(false);
  const mountedRef = useRef(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [cameraError, setCameraError] = useState('');
  const [qrDetectionAvailable, setQrDetectionAvailable] = useState<boolean | null>(null);
  const [isQrScanning, setIsQrScanning] = useState(false);

  const pauseQrScanning = (updateUi = true) => {
    scanActiveRef.current = false;
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (updateUi) setIsQrScanning(false);
  };

  const stopCamera = (updateUi = true) => {
    pauseQrScanning(updateUi);
    detectorRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    if (updateUi) setCameraStatus('idle');
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera(false);
    };
  }, []);

  const claimCode = (value: string) => {
    const verificationCode = verificationCodeFromQr(value);
    if (!verificationCode) {
      setCodeError('The QR code does not contain a receipt verification code.');
      return;
    }
    setCode(verificationCode);
    setCodeError('');
    pauseQrScanning();
    claim.mutate(
      { data: { verificationCode } },
      {
        onSuccess: (receipt) => setLocation(`/receipts/${receipt.id}`),
        onError: () => setCodeError('Receipt not found here. Make sure the merchant and scanner are using the same app environment (both preview or both published).'),
      },
    );
  };

  const scanFrame = async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;
    if (!scanActiveRef.current || !detector || !video) return;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        const barcodes = await detector.detect(video);
        if (!scanActiveRef.current) return;
        const rawValue = barcodes.find(barcode => barcode.rawValue?.trim())?.rawValue;
        const verificationCode = rawValue ? verificationCodeFromQr(rawValue) : '';
        if (verificationCode) {
          pauseQrScanning();
          claimCode(verificationCode);
          return;
        }
      } catch {
        // A frame may not contain a decodable QR code; continue scanning.
      }
    }

    if (scanActiveRef.current) {
      scanTimerRef.current = window.setTimeout(() => { void scanFrame(); }, 220);
    }
  };

  const resumeQrScanning = () => {
    if (!detectorRef.current || !streamRef.current || claim.isPending) return;
    setCodeError('');
    scanActiveRef.current = true;
    setIsQrScanning(true);
    void scanFrame();
  };

  const startCamera = async () => {
    if (cameraStatus === 'starting' || cameraStatus === 'ready') return;
    setCameraStatus('starting');
    setCameraError('');
    setCodeError('');
    setQrDetectionAvailable(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError('Camera access is unavailable. Open this page over HTTPS and allow camera access in your browser settings.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (!mountedRef.current || !videoRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      if (!mountedRef.current || streamRef.current !== stream) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      setCameraStatus('ready');

      const BarcodeDetectorApi = (window as Window & {
        BarcodeDetector?: NativeBarcodeDetectorConstructor;
      }).BarcodeDetector;

      let detector: NativeBarcodeDetector | null = null;
      if (BarcodeDetectorApi) {
        try {
          detector = new BarcodeDetectorApi({ formats: ['qr_code'] });
          setQrDetectionAvailable(true);
        } catch {
          setQrDetectionAvailable(false);
        }
      } else {
        setQrDetectionAvailable(false);
      }

      if (detector) {
        detectorRef.current = detector;
        scanActiveRef.current = true;
        setIsQrScanning(true);
        void scanFrame();
      }

      stream.getVideoTracks().forEach(track => {
        track.addEventListener('ended', () => {
          if (streamRef.current !== stream) return;
          stopCamera(false);
          setCameraStatus('error');
          setCameraError('The camera stopped. Check camera permissions and try again.');
        }, { once: true });
      });
    } catch (error) {
      stopCamera(false);
      if (!mountedRef.current) return;
      setCameraStatus('error');
      const name = error instanceof DOMException ? error.name : '';
      setCameraError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Camera permission was denied. Allow camera access for this site, then try again.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'No usable camera was found on this device.'
            : name === 'NotReadableError'
              ? 'The camera is being used by another app. Close it and try again.'
              : 'Could not start the camera. Check your browser permissions and try again.',
      );
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) {
      setCodeError('Enter the verification code from the merchant screen.');
      return;
    }
    claimCode(code);
  };

  return (
    <>
      <PageTitle eyebrow="claim receipt" title="Scan merchant screen." description="Point your camera at the FUTURERECEİPT QR code, or enter the code manually." />
      <div className="mx-auto max-w-lg rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-sm)] md:p-8">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-foreground text-card">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Live camera view for scanning a receipt QR code"
            className={`absolute inset-0 h-full w-full object-cover ${cameraStatus === 'ready' ? 'opacity-100' : 'opacity-0'}`}
            data-testid="receipt-camera-video"
          />
          {cameraStatus !== 'ready' ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div className="flex flex-col items-center">
                <Camera size={40} className={cameraStatus === 'starting' ? 'animate-pulse' : ''} />
                <p className="mt-3 text-sm font-semibold">
                  {cameraStatus === 'starting' ? 'Opening camera…' : cameraStatus === 'error' ? 'Camera unavailable' : 'Camera is off'}
                </p>
                {cameraStatus === 'idle' && (
                  <Button type="button" className="mt-4" onClick={() => { void startCamera(); }} data-testid="button-start-camera">
                    Open camera
                  </Button>
                )}
                {cameraStatus === 'starting' && <p className="mt-2 text-xs text-card/70">Allow camera access when your browser asks.</p>}
                {cameraStatus === 'error' && (
                  <>
                    <p className="mt-2 max-w-sm text-xs leading-5 text-card/75" role="alert">{cameraError}</p>
                    <Button type="button" variant="outline" className="mt-4 border-white/30 bg-white/10 text-white" onClick={() => { void startCamera(); }} data-testid="button-retry-camera">
                      Try again
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="pointer-events-none absolute inset-0 m-10 rounded-xl border-2 border-dashed border-accent/90 shadow-[0_0_0_999px_rgba(0,0,0,0.16)]" />
              <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 p-3 text-xs leading-4 text-white">
                <span className="block text-center">
                  {claim.isPending
                    ? 'Checking code…'
                    : qrDetectionAvailable && isQrScanning
                      ? 'Hold the merchant QR inside the frame.'
                      : qrDetectionAvailable
                        ? 'Scan paused.'
                    : 'Camera is live. Enter the printed claim code below.'}
                </span>
                <div className="mt-2 flex items-center justify-center gap-2">
                  {qrDetectionAvailable && !isQrScanning && !claim.isPending && (
                    <Button type="button" variant="outline" className="min-h-9 min-w-0 flex-1 whitespace-nowrap border-white/30 bg-white/10 px-3 text-white" onClick={resumeQrScanning} data-testid="button-rescan-qr">
                      Scan again
                    </Button>
                  )}
                  <Button type="button" variant="outline" className="min-h-9 min-w-0 flex-1 whitespace-nowrap border-white/30 bg-white/10 px-3 text-white" onClick={() => stopCamera()} data-testid="button-stop-camera">
                    Turn off
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
        {cameraStatus === 'ready' && qrDetectionAvailable === false && (
          <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
            Automatic QR scanning is not available in this browser. Enter the claim code shown below the QR code on the merchant screen.
          </p>
        )}
        <div className="mt-8 text-center">
          <p className="text-sm font-semibold text-muted-foreground">Or enter the code manually</p>
          <form onSubmit={submit} className="mt-4 flex gap-3">
            <input
              value={code}
              onChange={e => { setCode(e.target.value); setCodeError(''); }}
              placeholder="e.g. A1B2C3D4"
              aria-label="Receipt verification code"
              aria-invalid={Boolean(codeError)}
              className={`h-12 min-w-0 flex-1 rounded-xl border bg-background px-4 font-mono text-base uppercase outline-none focus:ring-1 ${codeError ? 'border-destructive bg-destructive/5 focus:border-destructive focus:ring-destructive/20' : 'border-border focus:border-primary focus:ring-primary/20'}`}
              data-testid="input-manual-code"
            />
            <Button type="submit" disabled={claim.isPending} data-testid="button-claim-receipt">
              {claim.isPending ? 'Claiming…' : 'Claim'}
            </Button>
          </form>
          {codeError && <p className="mt-3 text-sm text-destructive" role="alert">{codeError}</p>}
        </div>
      </div>
    </>
  );
}

function AccountChoice({ mode }: { mode: 'in' | 'up' }) {
  const { language } = useLanguage();
  const tr = (text: string) => translate(language, text);
  const [, setLocation] = useLocation();
  const handleSelect = (role: 'customer' | 'merchant') => {
    setStoredValue('ECOBILL_PENDING_ACCOUNT_ROLE', role);
    setLocation(mode === 'in' ? '/sign-in' : '/sign-up');
  };

  return (
    <div className="ecobill-noise flex min-h-[100dvh] items-center justify-center bg-[#f5f1e8] px-4 py-10">
      <div className="absolute left-6 top-6 md:left-10 md:top-8"><Logo /></div>
      <div className="absolute right-6 top-6 md:right-10 md:top-8"><LanguageSwitcher /></div>
      
      <div className="w-full max-w-4xl text-center">
        <h1 className="font-display text-4xl md:text-5xl mb-3">
          {tr(mode === 'up' ? 'Join FUTURERECEİPT' : 'Welcome back')}
        </h1>
        <p className="text-muted-foreground mb-12">
          {tr(mode === 'up' ? 'How would you like to use FUTURERECEİPT?' : 'Sign in to your FUTURERECEİPT account.')}
          {mode === 'in' && <span className="block mt-1 text-sm">{tr('Existing accounts will automatically open in their saved role.')}</span>}
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto text-left">
          {/* Customer Option */}
          <button 
            onClick={() => handleSelect('customer')}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-card p-8 shadow-[var(--shadow-md)] transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-[var(--shadow-lg)]"
            data-testid="button-choice-customer"
          >
            <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/5 blur-3xl transition group-hover:bg-primary/10" />
            <div className="relative">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <UserRound size={28} />
              </div>
              <h3 className="mt-6 font-display text-3xl">{tr('For Customers')}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {tr('A clear, private place for every receipt you earn. Understand your spending and see what your choices are saving.')}
              </p>
              <ul className="mt-8 space-y-3 text-sm font-semibold text-foreground">
                <li className="flex items-center gap-3"><Check size={16} className="text-primary" /> {tr('Store digital receipts')}</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-primary" /> {tr('Track spending habits')}</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-primary" /> {tr('Measure eco-impact')}</li>
              </ul>
            </div>
            <div className="relative mt-10 inline-flex items-center gap-2 text-sm font-bold text-primary group-hover:gap-3 transition-all">
              {tr(mode === 'up' ? 'Create personal account' : 'Customer sign in')} <ArrowRight size={16} />
            </div>
          </button>

          {/* Business Option */}
          <button 
            onClick={() => handleSelect('merchant')}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-card p-8 shadow-[var(--shadow-md)] transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-[var(--shadow-lg)]"
            data-testid="button-choice-merchant"
          >
            <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-orange-500/5 blur-3xl transition group-hover:bg-orange-500/10" />
            <div className="relative">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-500/10 text-orange-600">
                <Building2 size={28} />
              </div>
              <h3 className="mt-6 font-display text-3xl">{tr('For Businesses')}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {tr('A better last step at the register. Send verified digital receipts in a few taps and reduce your thermal paper costs.')}
              </p>
              <ul className="mt-8 space-y-3 text-sm font-semibold text-foreground">
                <li className="flex items-center gap-3"><Check size={16} className="text-orange-600" /> {tr('POS QR integration')}</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-orange-600" /> {tr('Digital receipt history')}</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-orange-600" /> {tr('Sales analytics')}</li>
              </ul>
            </div>
            <div className="relative mt-10 inline-flex items-center gap-2 text-sm font-bold text-orange-600 group-hover:gap-3 transition-all">
              {tr(mode === 'up' ? 'Set up business account' : 'Business sign in')} <ArrowRight size={16} />
            </div>
          </button>
        </div>

        <div className="mt-12 text-sm text-muted-foreground">
          {tr(mode === 'up' ? 'Already have an account? ' : "Don't have an account yet? ")}
          <Link href={mode === 'up' ? '/login' : '/get-started'} className="font-bold text-foreground hover:text-primary transition" data-testid="link-switch-mode">
            {tr(mode === 'up' ? 'Sign in' : 'Create an account')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/get-started" component={() => <AccountChoice mode="up" />} />
        <Route path="/login" component={() => <AccountChoice mode="in" />} />
        <Route path="/sign-in/*?" component={() => <AuthPage mode="in" />} />
        <Route path="/sign-up/*?" component={() => <AuthPage mode="up" />} />
        <Route path="/terms" component={() => <LegalPage kind="terms" />} />
        <Route path="/privacy" component={() => <LegalPage kind="privacy" />} />
        <Route path="/onboarding"><Protected><Onboarding /></Protected></Route>
        <Route path="/dashboard"><Protected><Dashboard /></Protected></Route>
        <Route path="/scan"><Protected><ScanReceipt /></Protected></Route>
        <Route path="/receipts"><Protected><Receipts /></Protected></Route>
        <Route path="/receipts/:id"><Protected><ReceiptDetail /></Protected></Route>
        <Route path="/pos"><Protected><Pos /></Protected></Route>
        <Route path="/analytics"><Protected><Analytics /></Protected></Route>
        <Route path="/profile"><Protected><Profile /></Protected></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function ClerkRouter() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && /^ECB-[A-F0-9]{8}$/.test(ref.toUpperCase())) {
      setStoredValue('ECOBILL_REFERRAL_CODE', ref.toUpperCase());
    }
  }, []);

  const localization = language === 'es'
    ? { signIn: { start: { title: 'Te damos la bienvenida', subtitle: 'Tus recibos te esperan.' } }, signUp: { start: { title: 'Adiós a los recibos de papel. Hola, futuro verde.', subtitle: 'Crea tu cuenta gratis de FUTURERECEİPT.' } } }
    : { signIn: { start: { title: 'Welcome back', subtitle: 'Your receipts are waiting.' } }, signUp: { start: { title: 'Goodbye Paper Receipts, Hello Green Future.', subtitle: 'Create your free FUTURERECEİPT account.' } } };

  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={localization} routerPush={to => setLocation(to.replace(basePath, '') || '/')} routerReplace={to => setLocation(to.replace(basePath, '') || '/', { replace: true })}><Router /></ClerkProvider>;
}

function AppContent() {
  if (!clerkPubKey) return <Home />;
  return <WouterRouter base={basePath}><ClerkRouter /></WouterRouter>;
}

function App() {
  return <LanguageProvider><AppContent /></LanguageProvider>;
}

export default App;