import './kampus.css';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/kampus/error-boundary';
import { Toaster } from '@/kampus/toaster';
import { TooltipProvider } from '@/kampus/tooltip';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  ArrowDown, ArrowLeft, ArrowRight, BadgeCheck, Bell, BriefcaseBusiness, Check, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Compass, FileImage, FilePlus2, Filter, Heart, ImagePlus, LayoutDashboard, Menu,
  MessageSquareText, Search, Send, ShieldCheck, Sparkles, Star, Upload, UserRound, UsersRound, WandSparkles, X,
} from 'lucide-react';

const queryClient = new QueryClient();
const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const supabaseKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const profileColumns = 'id,full_name,role,avatar_url,location,bio,company_name,industry,is_public,is_demo,created_at,updated_at';
type Profile = { id: string; full_name?: string; role?: 'creator' | 'brand'; avatar_url?: string; location?: string; bio?: string; company_name?: string; industry?: string; is_public?: boolean; is_demo?: boolean };
type Creator = Profile & { creator_profiles?: any; portfolio_items?: any[] };
type Brief = { id: string; title: string; company_name?: string; description?: string; objective?: string; content_type?: string; budget_min?: number; budget_max?: number; currency?: string; deadline?: string; required_skills?: string[]; required_tools?: string[]; formats?: string[]; aspect_ratio?: string; commercial_use?: boolean; licensing_requirements?: string; status?: string; brand_id?: string };
type Feedback = { message: string; kind?: 'error' | 'success' } | null;

function userFacingErrorMessage(message: string) {
  const normalized = message.toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Supabase has temporarily limited this request. Wait for the cooldown before retrying, and avoid repeated email requests.';
  }
  if (normalized.includes('email not confirmed')) return 'Please verify your email before signing in.';
  if (normalized.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (normalized.includes('user not found') || normalized.includes('account not found')) return 'No account was found with these credentials.';
  if (normalized.includes('already registered') || normalized.includes('user already exists')) return 'Email already registered.';
  if (normalized.includes('invalid email') || normalized.includes('email address is invalid')) return 'Enter a valid email address.';
  if (normalized.includes('password') && (normalized.includes('weak') || normalized.includes('at least'))) return 'Password must be at least 8 characters.';
  if (normalized.includes('database error saving new user') || normalized.includes('profiles') && normalized.includes('schema cache')) {
    return 'Account setup is unavailable because the marketplace profile schema is not ready.';
  }
  if (normalized.includes('could not find the table') || normalized.includes('pgrst205') || normalized.includes('relation') && normalized.includes('does not exist')) {
    return 'Marketplace data is not set up yet. The required Supabase tables are unavailable.';
  }
  if (normalized.includes('permission denied') || normalized.includes('row-level security') || normalized.includes('rls')) {
    return 'You do not have permission to complete that action.';
  }
  if (normalized.includes('not configured')) return 'Supabase is not configured for this app yet.';
  if (normalized.includes('duplicate key') || normalized.includes('unique constraint')) return 'This record already exists.';
  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('fetch error')) {
    return 'Unable to connect. Check your connection and try again.';
  }
  if (normalized.includes('violates') || normalized.includes('constraint') || normalized.includes('invalid input syntax') || normalized.includes('column ') || normalized.includes('jwt') || normalized.includes('postgrest')) {
    return 'The request could not be saved. Check that the marketplace database is set up and try again.';
  }
  return 'Something went wrong. Please try again.';
}

function isTechnicalError(message: string) {
  return /rate limit|too many requests|invalid login credentials|email not confirmed|already registered|user not found|account not found|invalid email|database error|pgrst\d|schema cache|could not find the table|relation .*does not exist|permission denied|row.level security|\brls\b|duplicate key|unique constraint|failed to fetch|network|fetch error|violates|constraint|invalid input syntax|column |jwt|postgrest|not configured/i.test(message);
}

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message) console.warn('[Kampus.VC] Authentication request failed:', message);
  if (!message) return 'Unable to complete authentication. Please try again.';
  const safeMessage = userFacingErrorMessage(message);
  return safeMessage === 'Something went wrong. Please try again.'
    ? 'Unable to complete authentication. Please try again.'
    : safeMessage;
}

function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileUnavailable, setProfileUnavailable] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [profileLoading, setProfileLoading] = useState(false);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!live) return;
      if (error) console.error('[Kampus.VC] Initial auth session lookup failed:', error.message);
      setSession(data.session);
      setLoading(false);
    }).catch((error: unknown) => {
      if (!live) return;
      console.error('[Kampus.VC] Initial auth session lookup failed:', error);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    let live = true;
    if (!session?.user || !supabase) {
      setProfile(null);
      setProfileUnavailable(false);
      setProfileLoading(false);
      return;
    }
    setProfile(null);
    setProfileUnavailable(false);
    setProfileLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase.from('profiles').select(profileColumns).eq('id', session.user.id).maybeSingle();
        if (!live) return;
        if (error) console.warn('[Kampus.VC] Profile lookup failed:', error.message);
        if (data) {
          setProfile(data as Profile);
          setProfileUnavailable(false);
        } else {
          const metadata = session.user.user_metadata || {};
          setProfile({
            id: session.user.id,
            full_name: metadata['full_name'] || session.user.email?.split('@')[0] || '',
            company_name: metadata['company_name'] || undefined,
            industry: metadata['industry'] || undefined,
          });
          setProfileUnavailable(true);
        }
      } catch (error) {
        if (!live) return;
        console.error('[Kampus.VC] Profile lookup failed:', error);
        const metadata = session.user.user_metadata || {};
        setProfile({
          id: session.user.id,
          full_name: metadata['full_name'] || session.user.email?.split('@')[0] || '',
          company_name: metadata['company_name'] || undefined,
          industry: metadata['industry'] || undefined,
        });
        setProfileUnavailable(true);
      } finally {
        if (live) setProfileLoading(false);
      }
    })();
    return () => { live = false; };
  }, [session]);
  return { session, profile, loading, profileLoading, setProfile, profileUnavailable };
}

function useRecords<T>(table: string, query?: { column?: string; value?: string; order?: string; ascending?: boolean; limit?: number; enabled?: boolean }) {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (query?.enabled === false) { setRecords([]); setLoading(false); setError(''); return; }
    if (!supabase) { setRecords([]); setLoading(false); setError('Connect Supabase to load live marketplace records.'); return; }
    setLoading(true); setError('');
    try {
      let request: any = supabase.from(table).select(table === 'profiles' ? `${profileColumns},creator_profiles(*),portfolio_items(*)` : '*');
      if (query?.column && query.value) request = request.eq(query.column, query.value);
      if (query?.order) request = request.order(query.order, { ascending: query.ascending ?? false });
      if (query?.limit) request = request.limit(query.limit);
      const { data, error: issue } = await request;
      if (issue) throw issue;
      setRecords((data || []) as T[]);
    } catch (issue: any) { setError(userFacingErrorMessage(issue?.message || '')); }
    finally { setLoading(false); }
  }, [table, query?.column, query?.value, query?.order, query?.ascending, query?.limit, query?.enabled]);
  useEffect(() => { void reload(); }, [reload]);
  return { records, loading, error, reload };
}

function useRecord<T>(table: string, id?: string) {
  const [record, setRecord] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    if (!supabase) { setLoading(false); setError('Connect Supabase to load this record.'); return; }
    setLoading(true); setError('');
    const { data, error: issue } = await supabase.from(table).select(table === 'profiles' ? `${profileColumns},creator_profiles(*),portfolio_items(*)` : '*').eq('id', id).maybeSingle();
    if (issue) setError(userFacingErrorMessage(issue.message)); else setRecord(data as T | null);
    setLoading(false);
  }, [table, id]);
  useEffect(() => { void reload(); }, [reload]);
  return { record, loading, error, reload };
}

function App() {
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<Feedback>(null);
  const [path] = useLocation();
  useEffect(() => { setMenuOpen(false); setNotice(null); }, [path]);
  const notify = (message: string, kind: 'error' | 'success' = 'success') => {
    if (kind === 'error') {
      console.error('[Kampus.VC] Operation failed:', message);
      if (isTechnicalError(message)) message = userFacingErrorMessage(message);
    }
    setNotice({ message, kind });
    window.setTimeout(() => setNotice(null), 4200);
  };
  const protect = (page: ReactNode, roles?: Profile['role'][]) => <ProtectedRoute auth={auth} roles={roles}>{page}</ProtectedRoute>;
  return <QueryClientProvider client={queryClient}><TooltipProvider>
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <div className="app-shell">
        <header className="topbar"><div className="nav-inner">
          <Link href="/" className="brand"><span className="brand-mark"><Sparkles size={16}/></span>Kampus.VC</Link>
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(!menuOpen)} data-testid="button-menu">{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
          <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
            <NavLink href="/" current={path}>Home</NavLink>
            {auth.session && auth.profileLoading && <span className="muted" role="status">Loading account…</span>}
            {auth.session && auth.profile?.role === 'creator' && <>
              <NavLink href="/projects" current={path}>Discover Projects</NavLink>
              <NavLink href="/applications" current={path}>My Applications</NavLink>
              <NavLink href="/invitations" current={path}>Invitations</NavLink>
              <NavLink href="/portfolio" current={path}>Portfolio</NavLink>
              <NavLink href="/profile" current={path}>My Profile</NavLink>
              <NavLink href="/notifications" current={path}>Notifications</NavLink>
              <NavLink href="/assistant" current={path}>AI Assistant</NavLink>
            </>}
            {auth.session && auth.profile?.role === 'brand' && <>
              <NavLink href="/discover-creators" current={path}>Discover Creators</NavLink>
              <NavLink href="/dashboard" current={path}>My Briefs</NavLink>
              <NavLink href="/applications" current={path}>Applications</NavLink>
              <NavLink href="/invitations" current={path}>Invitations</NavLink>
              <NavLink href="/briefs/new" current={path}>Create Brief</NavLink>
              <NavLink href="/profile" current={path}>Profile</NavLink>
              <NavLink href="/notifications" current={path}>Notifications</NavLink>
              <NavLink href="/assistant" current={path}>AI Assistant</NavLink>
            </>}
            {!auth.session && !auth.loading && <a href="/#how-it-works">How It Works</a>}
          </nav>
          <div className="nav-actions">
            {auth.profile && <Link className="button small" href="/dashboard" data-testid="link-workspace"><LayoutDashboard size={14}/>Workspace</Link>}
            {auth.loading || (auth.session && auth.profileLoading) ? null : !auth.session ? <>
              <Link href="/login" className="button small" data-testid="link-sign-in">Sign in</Link>
              <Link href="/signup" className="button primary small" data-testid="link-sign-up">Get Started</Link>
            </> : <>
              {auth.profile?.full_name && <span className="nav-user" data-testid="text-account-name"><span className="nav-avatar">{auth.profile.avatar_url?<img src={auth.profile.avatar_url} alt=""/>:auth.profile.full_name.slice(0,1).toUpperCase()}</span><span>{auth.profile.full_name}<small>{auth.profile.role || 'Account'}</small></span></span>}
              <button className="button small" onClick={async () => {
                const { error } = await supabase?.auth.signOut() || {};
                if (error) return notify(error.message, 'error');
                queryClient.clear();
                notify('You are signed out.');
              }} data-testid="button-sign-out"><UserRound size={14}/>Sign out</button>
            </>}
          </div>
        </div></header>
        {notice && <div className={`notice ${notice.kind === 'error' ? 'notice-error' : ''}`} role="status">{notice.message}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14}/></button></div>}
        {auth.profileUnavailable && <div className="notice notice-error" role="status">You are signed in, but your marketplace profile could not be loaded. Account features will stay limited until the Supabase profile tables are available.</div>}
        <RoutedErrorBoundary resetKey={path}>
          <Switch>
            <Route path="/" component={() => <Home auth={auth} notify={notify}/>}/>
            <Route path="/creators" component={() => protect(<Creators auth={auth} notify={notify}/>, ['brand'])}/>
            <Route path="/discover-creators" component={() => protect(<Creators auth={auth} notify={notify}/>, ['brand'])}/>
            <Route path="/creators/:id" component={() => protect(<CreatorProfile auth={auth} notify={notify}/>, ['brand'])}/>
            <Route path="/creator/:id" component={() => protect(<CreatorProfile auth={auth} notify={notify}/>, ['brand'])}/>
            <Route path="/projects" component={() => protect(<Projects auth={auth} notify={notify}/>, ['creator'])}/>
            <Route path="/projects/:id" component={() => protect(<ProjectDetail auth={auth} notify={notify}/>, ['creator'])}/>
            <Route path="/project/:id" component={() => protect(<ProjectDetail auth={auth} notify={notify}/>, ['creator'])}/>
            <Route path="/brief/:id" component={() => protect(<ProjectDetail auth={auth} notify={notify}/>, ['creator'])}/>
            <Route path="/briefs/new" component={() => protect(<BriefBuilder auth={auth} notify={notify}/>, ['brand'])}/>
            <Route path="/create-brief" component={() => protect(<BriefBuilder auth={auth} notify={notify}/>, ['brand'])}/>
            <Route path="/briefs/:id/matches" component={() => protect(<Matches auth={auth} notify={notify}/>, ['brand'])}/>
            <Route path="/applications" component={() => protect(<Applications auth={auth} notify={notify}/>)}/>
            <Route path="/invitations" component={() => protect(<Invitations auth={auth} notify={notify}/>)}/>
            <Route path="/dashboard" component={() => protect(<Dashboard auth={auth} notify={notify}/>)}/>
            <Route path="/portfolio" component={() => protect(<Portfolio auth={auth} notify={notify}/>, ['creator'])}/>
            <Route path="/workspace/:id" component={() => protect(<Workspace auth={auth} notify={notify}/>)}/>
            <Route path="/engagement/:id" component={() => protect(<Workspace auth={auth} notify={notify}/>)}/>
            <Route path="/profile" component={() => protect(<AccountProfile auth={auth} notify={notify}/>)}/>
            <Route path="/settings" component={() => protect(<AccountProfile auth={auth} notify={notify}/>)}/>
            <Route path="/notifications" component={() => protect(<Notifications auth={auth} notify={notify}/>)}/>
            <Route path="/assistant" component={() => protect(<Assistant auth={auth} notify={notify}/>)}/>
            <Route path="/ai-assistant" component={() => protect(<Assistant auth={auth} notify={notify}/>)}/>
            <Route path="/auth" component={() => <AuthPage auth={auth} notify={notify}/>}/>
            <Route path="/login" component={() => <AuthPage key="login" initialMode="signin" auth={auth} notify={notify}/>}/>
            <Route path="/signup" component={() => <AuthPage key="signup" initialMode="signup" auth={auth} notify={notify}/>}/>
            <Route path="/forgot-password" component={() => <AuthPage key="forgot-password" initialMode="reset" auth={auth} notify={notify}/>}/>
            <Route path="/reset-password" component={() => <AuthPage key="reset-password" initialMode="new-password" auth={auth} notify={notify}/>}/>
            <Route component={NotFound}/>
          </Switch>
        </RoutedErrorBoundary>
        <SiteFooter/>
      </div>
    </WouterRouter><Toaster/>
  </TooltipProvider></QueryClientProvider>;
}

function ProtectedRoute({auth,roles,children}:{auth:any;roles?:Profile['role'][]|undefined;children:ReactNode}) {
  const [path,setLocation]=useLocation();
  useEffect(()=>{
    if(!auth.loading&&!auth.session)setLocation(`/login?redirect=${encodeURIComponent(path)}`);
    else if(auth.session&&!auth.profileLoading&&auth.profile?.role&&roles&&!roles.includes(auth.profile.role))setLocation('/dashboard');
  },[auth.loading,auth.session,auth.profileLoading,auth.profile?.role,roles,path,setLocation]);
  if(auth.loading||(auth.session&&auth.profileLoading))return <main className="page"><div className="panel" role="status">Checking your account…</div></main>;
  if(!auth.session)return <main className="page"><div className="panel" role="status">Redirecting to sign in…</div></main>;
  if(!auth.profile?.role)return <main className="page"><EmptyState title="Profile setup is required" text="You are signed in, but a creator or brand profile is not available. Marketplace access will unlock when your Supabase profile is ready." action="Return home" href="/"/></main>;
  if(roles&&!roles.includes(auth.profile.role))return <main className="page"><EmptyState title="This page is not available for your account" text="You have been redirected to your role-specific workspace." action="Open workspace" href="/dashboard"/></main>;
  return <>{children}</>;
}

function NavLink({ href, current, children }: { href: string; current: string; children: ReactNode }) {
  const active = href === '/' ? current === '/' : current.startsWith(href);
  return <Link href={href} className={active ? 'active' : ''}>{children}</Link>;
}
function RoutedErrorBoundary({ children, resetKey }: { children: ReactNode; resetKey: string }) { return <ErrorBoundary resetKey={resetKey}>{children}</ErrorBoundary>; }
function SiteFooter() { return <footer className="footer"><div className="footer-inner"><Link href="/" className="brand"><span className="brand-mark"><Sparkles size={14}/></span>Kampus.VC</Link><span>Creative work, made human between people and AI.</span><div className="row"><Link href="/assistant">AI Assistant</Link><Link href="/projects">Browse work</Link><Link href="/auth">Account</Link></div></div></footer>; }

function Home({ auth, notify }: { auth: any; notify: any }) {
  const [, setLocation] = useLocation();
  const creators = useRecords<Creator>('profiles', { column: 'role', value: 'creator', limit: 4 });
  const briefs = useRecords<Brief>('briefs', { column: 'status', value: 'published', order: 'created_at', limit: 3 });
  const [query, setQuery] = useState('');
  return <>
    <section className="hero"><div className="hero-inner">
      <div className="hero-copy animate-in"><div className="eyebrow">A creative marketplace for the AI era</div><h1>Your next creative <span>vision starts here.</span></h1><p>Meet AI creators, explore extraordinary work, and bring your brand campaigns to life with people who know how to make it matter.</p>
        <form className="searchbar" onSubmit={(e) => { e.preventDefault(); setLocation(`/creators?q=${encodeURIComponent(query)}`); }}><Search size={16} color="#8883a5"/><input aria-label="Search creators" placeholder="Search by creator name, skills, tool or specialization…" value={query} onChange={(e) => setQuery(e.target.value)}/><button aria-label="Search"><ArrowRight size={17}/></button></form>
        <div className="row" style={{ marginTop: 13, flexWrap: 'wrap' }}><Link className="button primary" href="/creators">Explore creators <ArrowRight size={15}/></Link><Link className="button" href="/assistant"><WandSparkles size={14}/>AI Assistant</Link><Link className="button" href="/briefs/new">Create a brief</Link></div>
        <div className="tag-row" style={{ marginTop: 14 }}><span className="tag">AI filmmaking</span><span className="tag">AI animation</span><span className="tag">Generative art</span><span className="tag">Product advertising</span></div>
      </div>
      <div className="hero-visual" aria-label="Abstract AI creator artwork"><div className="hero-art"><div className="art-main"/><div className="art-side"><div className="art-tile"/><div className="art-tile"/></div><div className="float-chip"><Sparkles size={14}/> Human taste. AI possibility.</div><div className="float-chip bottom"><BadgeCheck size={14}/> Creators, not prompts</div></div></div>
    </div></section>
    <div className="stats-strip"><Stat icon={<UsersRound size={17}/>} value="Creator-led" label="Distinct creative voices"/><Stat icon={<FileImage size={17}/>} value="Real briefs" label="Work with clear intent"/><Stat icon={<ShieldCheck size={17}/>} value="Transparent" label="Explainable matching"/><Stat icon={<BriefcaseBusiness size={17}/>} value="End to end" label="From idea to review"/></div>
    <main className="page" style={{ paddingTop: 0 }}>
      <section className="section"><div className="section-head"><div><h2>Featured creators</h2><p>Meet the people shaping what comes next.</p></div><Link href="/creators" className="text-link">View all <ArrowRight size={14}/></Link></div>
        {creators.loading ? <SkeletonGrid/> : creators.records.length ? <div className="creator-grid">{creators.records.map((c,i)=><CreatorCard key={c.id} creator={c} index={i} />)}</div> : <EmptyState title={creators.error ? 'Creator directory is waiting to connect' : 'The creator directory is getting started'} text={creators.error || 'Published creator profiles will appear here once they are available in Supabase.'} action="Discover creators" href="/creators"/>}
      </section>
      <section className="section"><div className="section-head"><div><h2>Find your creative lane</h2><p>Browse by the kind of work you want to make.</p></div><Link href="/projects" className="text-link">Explore projects <ArrowRight size={14}/></Link></div><div className="category-grid">{[['▦','AI Filmmaking','Video & short films'],['◈','AI Animation','Animated & illustration'],['✳','Generative Art','Digital art & explorations'],['↗','Product Advertising','Brand & product visuals'],['▧','Fashion & Lifestyle','Campaign & motion'] as [string, string, string][]).map(([icon,name,desc])=><Link href={`/projects?type=${encodeURIComponent(name)}`} className="category" key={name}><div className="category-icon">{icon}</div><strong>{name}</strong><small>{desc}</small></Link>)}</div></section>
      <section className="section"><div className="section-head"><div><h2>From first spark to final file</h2><p>A clear path for both sides of the collaboration.</p></div></div><div className="steps-grid">{[['01','Discover creators','Browse portfolios and find the right creative fit.'],['02','Share your brief','Tell creators what you need. Keep rights and budget explicit.'],['03','Collaborate and review','Manage stages, deliverables, feedback and revisions together.'],['04','Receive final assets','Approve the delivery, then leave a review.']].map(([n,title,desc],i)=><div className="step-card" key={n}><div className="step-icon">{[<Compass size={17}/>,<FilePlus2 size={17}/>,<MessageSquareText size={17}/>,<Check size={17}/>][i]}</div><strong>{n}. {title}</strong><p>{desc}</p></div>)}</div></section>
      <section className="section"><div className="section-head"><div><h2>Open creative briefs</h2><p>Live opportunities published by brands and agencies.</p></div><Link href="/projects" className="text-link">Browse projects <ArrowRight size={14}/></Link></div>
        {briefs.loading ? <div className="skeleton-line"/> : briefs.records.length ? <div className="list-stack">{briefs.records.map(b=><ProjectCard key={b.id} brief={b}/>)}</div> : <EmptyState title="No published briefs yet" text={briefs.error || 'When brands publish a brief, creators can discover and apply to the opportunity here.'} action="Write a brief" href="/briefs/new"/>}
      </section>
    </main>
  </>;
}
function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) { return <div className="stat"><div className="stat-icon">{icon}</div><div><strong>{value}</strong><small>{label}</small></div></div>; }
function SkeletonGrid() { return <div className="creator-grid">{[1,2,3,4].map(i=><div className="creator-card" key={i}><div className="skeleton-cover"/><div className="creator-info"><div className="skeleton-line"/><div className="skeleton-line short"/></div></div>)}</div>; }
function EmptyState({ title, text, action, href }: { title: string; text: string; action?: string; href?: string }) { return <div className="empty-state"><div className="empty-icon"><Sparkles size={20}/></div><h3>{title}</h3><p>{text}</p>{action && href && <Link className="button primary small" href={href}>{action}<ArrowRight size={14}/></Link>}</div>; }
function CreatorCard({ creator, index = 0 }: { creator: Creator; index?: number }) {
  const prof = creator.creator_profiles || {};
  const image = (creator.portfolio_items || []).find(item => item.is_published && (item.thumbnail_url || item.media_url));
   return <article className="creator-card" data-testid={`card-creator-${creator.id}`}><div className={`cover c${(index%6)+1}`} style={image ? {backgroundImage:`url(${image.thumbnail_url||image.media_url})`,backgroundSize:'cover',backgroundPosition:'center'} : {}}><span className="cover-label">{image?.title || prof.specializations?.[0] || 'AI Creator'}</span>{!image&&<span className="illustrative-label">Art direction preview</span>}</div><div className="creator-info">{creator.is_demo&&<span className="pill sample-pill">Sample profile</span>}<div className="creator-name">{creator.full_name || 'Kampus creator'}</div><div className="creator-sub">{prof.headline || creator.location || 'Independent AI creator'}</div><div className="creator-meta"><span><Star size={11} fill="#e9b948" color="#e9b948"/> {prof.rating || 'New'}</span><span><BriefcaseBusiness size={11}/> {prof.completed_projects || 0} projects</span></div><div className="tag-row">{(prof.skills || prof.specializations || []).slice(0,3).map((s:string)=><span className="tag" key={s}>{s}</span>)}</div><Link href={`/creators/${creator.id}`} className="button primary full">View portfolio</Link></div></article>;
}
function ProjectCard({ brief }: { brief: Brief }) {
  return <Link href={`/projects/${brief.id}`} className="project-card"><div style={{ flex: 1 }}><div className="project-company"><span className="company-mark">{(brief.company_name || 'B').slice(0,1)}</span>{brief.company_name || 'Brand team'} <span>·</span> {brief.content_type || 'Creative brief'}</div><h3>{brief.title}</h3><p>{brief.description || brief.objective || 'A published creative brief seeking the right AI creator.'}</p><div className="tag-row">{(brief.required_skills || []).slice(0,4).map(s=><span className="tag" key={s}>{s}</span>)}</div></div><div className="project-aside"><div className="budget">{brief.budget_min != null || brief.budget_max != null ? `${brief.currency || 'USD'} ${brief.budget_min ?? '—'}–${brief.budget_max ?? '—'}` : 'Budget not listed'}</div><span className="muted">{brief.deadline ? `Due ${new Date(brief.deadline).toLocaleDateString()}` : 'Deadline not listed'}</span><div style={{ marginTop: 11 }}><ArrowRight size={17} color="#8065d8"/></div></div></Link>;
}

function Creators({ auth, notify }: { auth: any; notify: any }) {
  const { records, loading, error } = useRecords<Creator>('profiles', { column: 'role', value: 'creator' });
  const [query, setQuery] = useState(new URLSearchParams(window.location.search).get('q') || '');
  const [filters,setFilters]=useState({specialty:'',tool:'',skill:'',contentType:'',format:'',aspectRatio:'',availability:'',rating:'',commercialUse:false});
  const unique=(values:string[])=>Array.from(new Set(values.filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const specialties=unique(records.flatMap(c=>c.creator_profiles?.specializations||[]));
  const tools=unique(records.flatMap(c=>c.creator_profiles?.ai_tools||[]));
  const skills=unique(records.flatMap(c=>c.creator_profiles?.skills||[]));
  const contentTypes=unique(records.flatMap(c=>c.creator_profiles?.content_types||[]));
  const formats=unique(records.flatMap(c=>c.creator_profiles?.supported_formats||[]));
  const aspectRatios=unique(records.flatMap(c=>c.creator_profiles?.aspect_ratios||[]));
  const filtered = useMemo(() => records.filter(c => {
    const p = c.creator_profiles || {};
    const portfolio=c.portfolio_items||[];
    const hay=[c.full_name,c.location,c.bio,p.headline,p.bio,...(p.skills||[]),...(p.specializations||[]),...(p.ai_tools||[]),...(p.ai_models||[]),...(p.content_types||[]),...(p.supported_formats||[]),...(p.aspect_ratios||[]),...portfolio.flatMap((item:any)=>[item.title,item.description,item.content_type,item.format,item.aspect_ratio,...(item.tools||[]),...(item.models||[]),...(item.skills||[])])].join(' ').toLowerCase();
    return (!query||hay.includes(query.trim().toLowerCase()))
      &&(!filters.specialty||(p.specializations||[]).includes(filters.specialty))
      &&(!filters.tool||(p.ai_tools||[]).includes(filters.tool))
      &&(!filters.skill||(p.skills||[]).includes(filters.skill))
      &&(!filters.contentType||(p.content_types||[]).includes(filters.contentType))
      &&(!filters.format||(p.supported_formats||[]).includes(filters.format))
      &&(!filters.aspectRatio||(p.aspect_ratios||[]).includes(filters.aspectRatio))
      &&(!filters.availability||p.availability_status===filters.availability)
      &&(!filters.rating||Number(p.rating||0)>=Number(filters.rating))
      &&(!filters.commercialUse||p.commercial_use_supported===true);
  }), [records,query,filters]);
  const clearFilters=()=>{setQuery('');setFilters({specialty:'',tool:'',skill:'',contentType:'',format:'',aspectRatio:'',availability:'',rating:'',commercialUse:false})};
  return <main className="page animate-in"><div className="page-title"><div><div className="eyebrow">People making new things</div><h1>Discover creators</h1><p>Find a creative partner by skill, specialty and working style.</p></div><Link href="/briefs/new" className="button primary"><FilePlus2 size={15}/>Post a brief</Link></div>
    <div className="content-grid"><aside className="filter-panel"><h3><Filter size={14}/> Refine your search</h3><div className="filter-group"><label>Search</label><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, tool, model, skill…"/></div>
      {([[ 'specialty','Specialization',specialties,'All specializations'],['tool','AI tool',tools,'All tools'],['skill','Skill',skills,'All skills'],['contentType','Content type',contentTypes,'All content types'],['format','Format',formats,'All formats'],['aspectRatio','Aspect ratio',aspectRatios,'All ratios'],['availability','Availability',['available','limited','unavailable'],'Any availability']] as [keyof typeof filters,string,string[],string][]).map(([key,label,options,empty])=><div className="filter-group" key={key}><label>{label}</label><select value={filters[key] as string} onChange={event=>setFilters({...filters,[key]:event.target.value})}><option value="">{empty}</option>{options.map(option=><option key={option} value={option}>{option}</option>)}</select></div>)}
      <div className="filter-group"><label>Minimum rating</label><select value={filters.rating} onChange={event=>setFilters({...filters,rating:event.target.value})}><option value="">Any rating</option><option value="4">4.0+</option><option value="4.5">4.5+</option></select></div>
      <label className="checkline"><input type="checkbox" checked={filters.commercialUse} onChange={event=>setFilters({...filters,commercialUse:event.target.checked})}/> Commercial use supported</label>
      <button type="button" className="text-link" onClick={clearFilters}>Clear search and filters</button>
    </aside>
      <div><div className="row between" style={{ marginBottom: 14 }}><span className="muted">{loading ? 'Loading creators…' : `${filtered.length} creators`}</span><span className="muted">Live public Supabase profiles</span></div>{loading ? <SkeletonGrid/> : error ? <EmptyState title="Could not load creator profiles" text={error}/> : filtered.length ? <div className="creator-grid">{filtered.map((c,i)=><CreatorCard key={c.id} creator={c} index={i}/>)}</div> : <EmptyState title="No creators match these filters" text="Try another search or clear some filters."/>}</div>
    </div>
  </main>;
}
function CreatorProfile({ auth, notify }: { auth: any; notify: any }) {
  const { id } = useParams<{ id: string }>();
  const { record, loading, error } = useRecord<Profile>('profiles', id);
  const items = useRecords<any>('portfolio_items', { column: 'creator_id', value: id });
  if (loading) return <main className="page"><div className="skeleton-cover" style={{ height: 180 }}/></main>;
  if (!record) return <main className="page"><EmptyState title={error ? 'Profile unavailable' : 'Creator not found'} text={error || 'This creator profile may have been removed or is not available.'} action="Browse creators" href="/creators"/></main>;
  const prof = (record as any).creator_profiles || {};
  const portfolio = items.records.filter(item=>item.is_published);
  return <main className="page animate-in"><Link href="/creators" className="text-link"><ArrowLeft size={14}/> Back to creators</Link><section className="profile-hero" style={{ marginTop: 17 }}><div className="profile-avatar">{(record.full_name||'K').slice(0,1)}</div><div><div className="eyebrow">{prof.availability_status || 'Creator profile'}</div><h1>{record.full_name || 'AI Creator'}</h1><p>{prof.headline || record.location || 'Independent creative collaborator'}</p><div className="tag-row">{(prof.specializations||[]).slice(0,4).map((s:string)=><span className="tag" key={s}>{s}</span>)}</div></div><div className="profile-actions"><button className="button" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.href);notify('Profile link copied.')}catch{notify('Your browser could not copy the profile link.','error')}}}><ArrowRight size={14}/>Copy profile link</button><Link className="button primary" href="/briefs/new">Invite to brief <Send size={14}/></Link></div></section>
    <div className="content-grid" style={{ gridTemplateColumns: '1fr 290px' }}><section><div className="section-head"><div><h2>Selected work</h2><p>Published portfolio projects shared by this creator.</p></div><span className="muted">{portfolio.length} projects</span></div>{items.loading ? <SkeletonGrid/> : items.error ? <EmptyState title="Portfolio could not load" text={items.error}/> : portfolio.length ? <div className="portfolio-grid">{portfolio.map((item:any,i:number)=><PortfolioTile key={item.id} item={item} index={i}/>)}</div> : <EmptyState title="No published projects yet" text="This creator has not published portfolio work to display."/>}<section className="section"><h2 style={{ fontFamily:'var(--app-font-serif)',fontSize:20 }}>About</h2><p className="muted" style={{ lineHeight:1.8 }}>{prof.bio || record.bio || 'This creator has not added a biography yet.'}</p></section></section>
      <aside className="panel"><h3 style={{ marginTop:0 }}>Creator details</h3><Info label="Location" value={record.location || 'Not listed'}/><Info label="Experience" value={prof.experience_years != null ? `${prof.experience_years} years` : 'Not listed'}/><Info label="Hourly rate" value={prof.hourly_rate != null ? `${prof.currency || 'USD'} ${prof.hourly_rate}/hr` : 'Not listed'}/><Info label="Commercial use" value={prof.commercial_use_supported ? 'Available' : 'Discuss with creator'}/><Info label="Tools" value={(prof.ai_tools||[]).join(', ') || 'Not listed'}/><Info label="Models" value={(prof.ai_models||[]).join(', ') || 'Not listed'}/><div className="alert">Verification signals are shown only when provided by the platform. Profile details are user-submitted.</div></aside>
    </div>
  </main>;
}
function Info({ label,value }: {label:string;value:string}) { return <div className="info-row"><small>{label}</small><span>{value}</span></div>; }
function PortfolioTile({ item,index }: {item:any;index:number}) { return <div className={`portfolio-tile p${index}`} style={item.thumbnail_url?{backgroundImage:`url(${item.thumbnail_url})`,backgroundSize:'cover',backgroundPosition:'center'}:{}}><span>{item.title || 'Portfolio work'}{item.content_type ? ` · ${item.content_type}` : ''}</span></div>; }

function Projects({ auth, notify }: { auth:any;notify:any }) {
  const projects = useRecords<Brief>('briefs',{column:'status',value:'published',order:'created_at'});
  const [search,setSearch]=useState('');
  const [kind,setKind]=useState(new URLSearchParams(window.location.search).get('type')||'');
  const [aspectRatio,setAspectRatio]=useState('');
  const [commercialOnly,setCommercialOnly]=useState(false);
  const filtered=projects.records.filter(b=>
    [b.title,b.description,b.objective,b.company_name,b.content_type,(b as any).visual_style,...(b.required_skills||[]),...(b.required_tools||[]),...(b.formats||[]),b.aspect_ratio].join(' ').toLowerCase().includes(search.trim().toLowerCase())
    &&(!kind||b.content_type===kind)
    &&(!aspectRatio||b.aspect_ratio===aspectRatio)
    &&(!commercialOnly||b.commercial_use===true));
  const types=Array.from(new Set(projects.records.map(p=>p.content_type).filter(Boolean))) as string[];
  const ratios=Array.from(new Set(projects.records.map(p=>p.aspect_ratio).filter(Boolean))) as string[];
  return <main className="page animate-in"><div className="page-title"><div><div className="eyebrow">Open opportunities</div><h1>Creative projects</h1><p>Real briefs. Clear terms. Work worth making.</p></div><Link className="button primary" href="/briefs/new"><FilePlus2 size={15}/>Create a brief</Link></div><div className="content-grid"><aside className="filter-panel"><h3>Filter projects</h3><div className="filter-group"><label>Search projects</label><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Campaign, tool, format, skill…"/></div><div className="filter-group"><label>Content type</label><select value={kind} onChange={e=>setKind(e.target.value)}><option value="">All types</option>{types.map(t=><option key={t}>{t}</option>)}</select></div><div className="filter-group"><label>Aspect ratio</label><select value={aspectRatio} onChange={e=>setAspectRatio(e.target.value)}><option value="">All ratios</option>{ratios.map(r=><option key={r}>{r}</option>)}</select></div><label className="checkline"><input type="checkbox" checked={commercialOnly} onChange={e=>setCommercialOnly(e.target.checked)}/> Commercial use required</label><button type="button" className="text-link" onClick={()=>{setSearch('');setKind('');setAspectRatio('');setCommercialOnly(false)}}>Clear filters</button><Link href="/applications" className="text-link">Your applications <ArrowRight size={13}/></Link></aside><section><div className="row between" style={{marginBottom:13}}><span className="muted">{projects.loading?'Loading live briefs…':`${filtered.length} published briefs`}</span><span className="muted">Only published Supabase briefs appear</span></div>{projects.loading?<ProjectSkeletons/>:projects.error?<EmptyState title="Briefs are unavailable" text={projects.error}/>:filtered.length?<div className="list-stack">{filtered.map(b=><ProjectCard key={b.id} brief={b}/>)}</div>:<EmptyState title="No briefs found" text="There are no published briefs matching your search yet. Try broadening the filters." action="Create a brief" href="/projects"/>}</section></div></main>;
}
function ProjectSkeletons(){return <div className="list-stack">{[1,2,3].map(i=><div className="project-card" key={i}><div style={{flex:1}}><div className="skeleton-line"/><div className="skeleton-line" style={{width:'85%'}}/></div></div>)}</div>}
function ProjectDetail({ auth,notify }: {auth:any;notify:any}) {
  const {id}=useParams<{id:string}>();
  const {record,loading,error,reload}=useRecord<Brief>('briefs',id);
  const applied=useRecords<any>('applications',{column:'brief_id',value:id});
  const [proposal,setProposal]=useState('');const [price,setPrice]=useState('');const [timeline,setTimeline]=useState('');const [busy,setBusy]=useState(false);const [saved,setSaved]=useState(false);
  const existing=applied.records.some(a=>a.creator_id===auth.session?.user?.id);
   const act=async(e:FormEvent)=>{e.preventDefault();if(!auth.session)return notify('Sign in as a creator to apply.','error');if(auth.profile?.role!=='creator')return notify('Only creator accounts can apply to a brief.','error');if(existing)return notify('You have already applied to this brief.','error');if(!supabase)return notify('Supabase is not configured.','error');setBusy(true);const {error:issue}=await supabase.from('applications').insert({brief_id:id,creator_id:auth.session.user.id,proposal,proposed_price:price?Number(price):null,estimated_timeline:timeline,status:'submitted'});setBusy(false);if(issue)notify(issue.message,'error');else{notify('Your application has been submitted.');await applied.reload();}};
  const save=async()=>{if(!auth.session)return notify('Sign in to save this brief.','error');if(!supabase)return notify('Supabase is not configured.','error');const {error:issue}=await supabase.from('saved_projects').insert({user_id:auth.session.user.id,brief_id:id});if(issue)notify(issue.message,'error');else{setSaved(true);notify('Brief saved to your account.');}};
  if(loading)return <main className="page"><ProjectSkeletons/></main>;
  if(!record)return <main className="page"><EmptyState title="Brief unavailable" text={error||'This brief may no longer be published.'} action="Browse projects" href="/projects"/></main>;
  return <main className="page animate-in"><Link href="/projects" className="text-link"><ArrowLeft size={14}/> All projects</Link><div className="content-grid" style={{gridTemplateColumns:'1fr 315px',marginTop:18}}><section><div className="panel"><div className="project-company"><span className="company-mark">{(record.company_name||'B').slice(0,1)}</span>{record.company_name||'Brand team'} · {record.content_type||'Creative brief'}</div><h1 style={{font:'800 30px var(--app-font-serif)',margin:'10px 0',color:'#29284b'}}>{record.title}</h1><p className="muted" style={{fontSize:13,lineHeight:1.8}}>{record.description||record.objective||'The brand has not added a full description.'}</p><div className="tag-row" style={{marginTop:16}}>{(record.required_skills||[]).map(s=><span className="tag" key={s}>{s}</span>)}</div><div className="form-section"><h3>Brief details</h3><Info label="Objective" value={record.objective||'Not specified'}/><Info label="Content type" value={record.content_type||'Not specified'}/><Info label="Formats" value={(record.formats||[]).join(', ')||'Not specified'}/><Info label="Aspect ratio" value={record.aspect_ratio||'Not specified'}/><Info label="Deliverables" value={(record as any).number_of_deliverables ?? 'Not specified'}/><Info label="Licensing" value={record.licensing_requirements||'Not specified'}/></div></div>
      <section className="section"><h2 style={{font:'700 19px var(--app-font-serif)'}}>Apply to this brief</h2>{!auth.profile?<AuthGate message="Sign in with a creator account to apply to this brief."/>:auth.profile.role!=='creator'?<div className="alert">Brand accounts can review applications from the brand dashboard.</div>:existing?<div className="empty-state"><div className="empty-icon"><Check size={19}/></div><h3>Application received</h3><p>You have already applied to this brief. Your application status will appear in Applications.</p><Link href="/applications" className="button small">View applications</Link></div>:<form className="panel" onSubmit={act}><div className="form-grid"><Field label="Your proposal" full><textarea required maxLength={3000} value={proposal} onChange={e=>setProposal(e.target.value)} placeholder="Tell the brand how you would approach this work…"/></Field><Field label="Proposed price"><input type="number" min="0" step="1" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Optional"/></Field><Field label="Estimated timeline"><input value={timeline} onChange={e=>setTimeline(e.target.value)} placeholder="e.g. 2 weeks"/></Field></div><button disabled={busy} className="button primary" style={{marginTop:16}}>{busy?'Submitting…':'Send application'}<ArrowRight size={14}/></button></form>}</section></section>
      <aside className="panel"><span className="pill">{record.status||'Published'}</span><h3 style={{fontSize:19,marginBottom:5}}>Project terms</h3><div className="budget" style={{fontSize:22}}>{record.budget_min!=null||record.budget_max!=null?`${record.currency||'USD'} ${record.budget_min??'—'}–${record.budget_max??'—'}`:'Budget not listed'}</div><div className="muted" style={{marginTop:4}}>{record.deadline?`Deadline ${new Date(record.deadline).toLocaleDateString()}`:'No deadline listed'}</div><div className="form-section"><Info label="Audience" value={(record as any).target_audience||'Not specified'}/><Info label="Visual style" value={(record as any).visual_style||'Not specified'}/><Info label="Commercial use" value={(record as any).commercial_use?'Required':'Not specified'}/></div><button onClick={save} className="button full" style={{marginTop:15}}><Heart size={15} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save project'}</button><p className="muted" style={{fontSize:10,lineHeight:1.5}}>Never assume licensing terms beyond what this brief states.</p></aside></div></main>;
}
function Field({label,children,full=false}:{label:string;children:ReactNode;full?:boolean}){return <div className={`field ${full?'full':''}`}><label>{label}</label>{children}</div>}
function AuthGate({message}:{message:string}){return <div className="empty-state"><div className="empty-icon"><UserRound size={18}/></div><h3>Sign in to continue</h3><p>{message}</p><Link href="/auth?redirect=%2Fapplications" className="button primary">Sign in or join</Link></div>}

function BriefBuilder({auth,notify}:{auth:any;notify:any}){
  const [values,setValues]=useState({title:'',company_name:auth.profile?.company_name||'',description:'',objective:'',target_audience:'',content_type:'AI Filmmaking',visual_style:'',required_tools:'',required_skills:'',formats:'',aspect_ratio:'',number_of_deliverables:'',budget_min:'',budget_max:'',currency:'USD',deadline:'',commercial_use:false,licensing_requirements:'',reference_links:'',additional_requirements:''});
  const [step,setStep]=useState(1);const [busy,setBusy]=useState(false);
  const update=(key:string,value:any)=>setValues(v=>({...v,[key]:value}));
   const publish=async()=>{if(!auth.session)return notify('Sign in with a brand or agency account to publish a brief.','error');if(auth.profile?.role!=='brand')return notify('Publishing briefs is available to brand accounts.','error');if(!values.title.trim()||!values.description.trim())return notify('Add a brief title and description before publishing.','error');if(!supabase)return notify('Supabase is not configured.','error');setBusy(true);try{const payload={...values,brand_id:auth.session.user.id,required_tools:csv(values.required_tools),required_skills:csv(values.required_skills),formats:csv(values.formats),reference_links:csv(values.reference_links),number_of_deliverables:values.number_of_deliverables?Number(values.number_of_deliverables):null,budget_min:values.budget_min?Number(values.budget_min):null,budget_max:values.budget_max?Number(values.budget_max):null,status:'published'};const {data,error}=await supabase.from('briefs').insert(payload).select('id').single();if(error)throw error;if(!data?.id)throw new Error('The brief was saved, but no brief id was returned.');const{error:matchError}=await supabase.rpc('match_creators_for_brief',{target_brief_id:data.id});window.location.assign(`/briefs/${data.id}/matches${matchError?'?match_generation_failed=1':''}`)}catch(error){notify(error instanceof Error?error.message:'Brief could not be published.','error')}finally{setBusy(false)}};
  if(!auth.profile)return <main className="page"><div className="page-title"><div className="eyebrow">Brand studio</div><h1>Create a brief</h1></div><AuthGate message="A brand account is required to draft and publish creative briefs."/></main>;
  if(auth.profile.role!=='brand')return <main className="page"><EmptyState title="This studio is for brands and agencies" text="Switch to a brand account to publish a creative brief." action="Go to dashboard" href="/dashboard"/></main>;
  return <main className="page animate-in"><div className="page-title"><div><div className="eyebrow">Brand studio</div><h1>Build a creative brief</h1><p>Give creators the context to propose thoughtful work.</p></div><span className="pill">Draft · not saved until publish</span></div><div className="content-grid" style={{gridTemplateColumns:'200px 1fr'}}><aside className="filter-panel"><h3>Brief sections</h3>{['The idea','Creative direction','Scope & terms'].map((s,i)=><button onClick={()=>setStep(i+1)} className={`section-nav ${step===i+1?'on':''}`} key={s}>{step>i+1?<Check size={13}/>:<span>{i+1}</span>}{s}</button>)}<div className="alert" style={{marginTop:20}}>AI suggestions never invent your budget, deadline or licensing rights.</div></aside><section className="panel">
    {step===1&&<div className="form-section"><h3>Start with the idea</h3><div className="form-grid"><Field label="Brief title" full><input maxLength={120} required value={values.title} onChange={e=>update('title',e.target.value)} placeholder="A name creators will understand"/></Field><Field label="Company or agency"><input value={values.company_name} onChange={e=>update('company_name',e.target.value)} placeholder={auth.profile.company_name||'Company name'}/></Field><Field label="Content type"><select value={values.content_type} onChange={e=>update('content_type',e.target.value)}>{['AI Filmmaking','AI Animation','Generative Art','Product Advertising','Fashion & Lifestyle','Other'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="What do you want to make?" full><textarea required maxLength={5000} value={values.description} onChange={e=>update('description',e.target.value)} placeholder="Describe the work, where it will live, and what success looks like."/></Field><Field label="Campaign objective" full><textarea value={values.objective} onChange={e=>update('objective',e.target.value)} placeholder="What should this creative achieve?"/></Field><Field label="Target audience" full><input value={values.target_audience} onChange={e=>update('target_audience',e.target.value)} placeholder="Who should the work speak to?"/></Field></div></div>}
    {step===2&&<div className="form-section"><h3>Creative direction</h3><div className="form-grid"><Field label="Visual style"><input value={values.visual_style} onChange={e=>update('visual_style',e.target.value)} placeholder="e.g. editorial, surreal, tactile"/></Field><Field label="Aspect ratio"><select value={values.aspect_ratio} onChange={e=>update('aspect_ratio',e.target.value)}><option value="">Choose if known</option>{['16:9','9:16','1:1','4:5','3:2','Other'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Required skills" full><input value={values.required_skills} onChange={e=>update('required_skills',e.target.value)} placeholder="Comma-separated skills"/></Field><Field label="Preferred tools" full><input value={values.required_tools} onChange={e=>update('required_tools',e.target.value)} placeholder="Optional; comma-separated tools"/></Field><Field label="Formats" full><input value={values.formats} onChange={e=>update('formats',e.target.value)} placeholder="e.g. MP4, PNG, layered source file"/></Field><Field label="Reference links" full><input value={values.reference_links} onChange={e=>update('reference_links',e.target.value)} placeholder="Comma-separated URLs"/></Field></div></div>}
    {step===3&&<div className="form-section"><h3>Scope and terms</h3><div className="form-grid"><Field label="Number of deliverables"><input type="number" min="1" value={values.number_of_deliverables} onChange={e=>update('number_of_deliverables',e.target.value)} placeholder="Set if known"/></Field><Field label="Deadline"><input type="date" value={values.deadline} onChange={e=>update('deadline',e.target.value)}/></Field><Field label="Minimum budget"><input type="number" min="0" value={values.budget_min} onChange={e=>update('budget_min',e.target.value)} placeholder="Optional"/></Field><Field label="Maximum budget"><input type="number" min="0" value={values.budget_max} onChange={e=>update('budget_max',e.target.value)} placeholder="Optional"/></Field><Field label="Currency"><select value={values.currency} onChange={e=>update('currency',e.target.value)}>{['USD','EUR','GBP','CAD','AUD','INR'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Licensing requirements"><input value={values.licensing_requirements} onChange={e=>update('licensing_requirements',e.target.value)} placeholder="State rights explicitly"/></Field><label className="checkline field full"><input type="checkbox" checked={values.commercial_use} onChange={e=>update('commercial_use',e.target.checked)}/> Commercial use is required</label><Field label="Additional requirements" full><textarea value={values.additional_requirements} onChange={e=>update('additional_requirements',e.target.value)} placeholder="Anything else creators should know?"/></Field></div></div>}
    <div className="form-actions"><button className="button" disabled={step===1} onClick={()=>setStep(Math.max(1,step-1))}><ArrowLeft size={14}/>Previous</button>{step<3?<button className="button primary" onClick={()=>setStep(step+1)}>Continue <ArrowRight size={14}/></button>:<button className="button primary" disabled={busy} onClick={publish}>{busy?'Publishing…':'Publish brief & find matches'}<ArrowRight size={14}/></button>}</div>
  </section></div></main>;
}
function csv(text:string){return text.split(',').map(x=>x.trim()).filter(Boolean)}

function Matches({auth,notify}:{auth:any;notify:any}){
  const {id}=useParams<{id:string}>();const {record:brief,loading,error}=useRecord<Brief>('briefs',id);const profiles=useRecords<Creator>('profiles',{column:'role',value:'creator'});const storedMatches=useRecords<any>('matches',{column:'brief_id',value:id,order:'match_score'});const [inviting,setInviting]=useState('');
  const rank=useMemo(()=>{
    const creators=new Map(profiles.records.map(creator=>[creator.id,creator]));
    if(storedMatches.records.length)return storedMatches.records.flatMap(match=>{
      const creator=creators.get(match.creator_id);if(!creator)return[];
      const explanation=match.match_explanation||{};
      return[{creator,score:Number(match.match_score)||0,breakdown:{skills:Number(match.skills_score??explanation.skills)||0,portfolio:Number(match.portfolio_score??explanation.portfolio)||0,tools:Number(match.tools_score??explanation.tools)||0,formats:Number(match.format_score??explanation.format)||0,other:Number(match.other_score??explanation.other)||0},reason:explanation.reason||null,isDemoExample:!!explanation.is_demo_example}];
    }).sort((a,b)=>b.score-a.score);
    return profiles.records.map(c=>{const p=c.creator_profiles||{};const skills=new Set([...(p.skills||[]),...(p.specializations||[])]);const wanted=brief?.required_skills||[];const skill=wanted.length?wanted.filter(s=>skills.has(s)).length/wanted.length:0.55;const portfolioCount=(c.portfolio_items||[]).filter((i:any)=>i.is_published).length;const portfolio=Math.min(1,portfolioCount/5);const requiredTools=brief?.required_tools||[];const tools=requiredTools.length?requiredTools.filter((t:string)=>(p.ai_tools||[]).includes(t)).length/requiredTools.length:.55;const format=brief?.formats?.length?brief.formats.filter((t:string)=>(p.supported_formats||[]).includes(t)).length/brief.formats.length:.55;const other=(p.availability_status==='available'?.7:.45);const score=Math.round((skill*.3+portfolio*.25+tools*.2+format*.15+other*.1)*100);return{creator:c,score,breakdown:{skills:Math.round(skill*100),portfolio:Math.round(portfolio*100),tools:Math.round(tools*100),formats:Math.round(format*100),other:Math.round(other*100)},reason:null,isDemoExample:false}}).sort((a,b)=>b.score-a.score)
  },[profiles.records,brief,storedMatches.records]);
  const invite=async(creatorId:string)=>{if(!auth.session)return notify('Sign in as a brand to invite creators.','error');if(auth.profile?.role!=='brand')return notify('Only brand accounts can send invitations.','error');if(!supabase)return notify('Supabase is not configured.','error');setInviting(creatorId);const {error:issue}=await supabase.from('invitations').insert({brief_id:id,brand_id:auth.session.user.id,creator_id:creatorId,message:`Would you be interested in collaborating on ${brief?.title||'our brief'}?`,status:'pending'});setInviting('');notify(issue?.message||'Invitation sent.',issue?'error':'success');};
  if(!auth.profile)return <main className="page"><AuthGate message="Sign in to view creator matches for a brand brief."/></main>;
  const matchGenerationFailed=new URLSearchParams(window.location.search).get('match_generation_failed')==='1';
  return <main className="page animate-in"><div className="page-title"><div><div className="eyebrow">Transparent discovery</div><h1>Creator matches</h1><p>{brief?.title||'Your brief'} · ranked by explainable profile and portfolio signals</p></div><Link href="/dashboard" className="button">Dashboard</Link></div>{loading||profiles.loading||storedMatches.loading?<ProjectSkeletons/>:error||profiles.error||storedMatches.error?<EmptyState title="Matches are unavailable" text={error||profiles.error||storedMatches.error}/>:<>{matchGenerationFailed&&<div className="alert">The brief is published, but saved match records could not be generated. Showing an on-page estimate until saved matches are available.</div>}<div className="alert">{storedMatches.records.length?'Stored match scores compare skills, portfolio, tools, formats and availability.':'On-page prototype estimate only.'} These scores are explainable decision support, not a hiring recommendation. Skills 30%, portfolio 25%, tools 20%, formats 15%, other signals 10%. No automatic hiring.</div><div className="list-stack">{rank.map(({creator,score,breakdown,reason,isDemoExample})=><div className="match-card" key={creator.id}><div className="row between"><div className="row"><div className="avatar">{(creator.full_name||'K').slice(0,1)}</div><div><Link className="creator-name" href={`/creators/${creator.id}`}>{creator.full_name||'Creator'} <BadgeCheck size={13}/></Link><div className="creator-sub">{creator.creator_profiles?.headline||creator.location||'AI Creator'}</div></div></div><span className="match-score">{score}% match</span></div><p className="muted" style={{fontSize:11,lineHeight:1.55}}>Signals: skills {breakdown.skills}%, portfolio {breakdown.portfolio}%, tools {breakdown.tools}%, formats {breakdown.formats}%, other {breakdown.other}%.</p>{reason&&<p className="match-reason">{isDemoExample?'Demo explanation: ':'Why it matches: '}{reason}</p>}<div className="row between"><Link href={`/creators/${creator.id}`} className="text-link">Review portfolio <ArrowRight size={13}/></Link><button className="button primary small" disabled={inviting===creator.id} onClick={()=>invite(creator.id)}>{inviting===creator.id?'Sending…':'Invite to brief'}<Send size={13}/></button></div></div>)}</div>{!rank.length&&<EmptyState title="No creator profiles available yet" text="Published creator profiles will be matchable once they are added."/>}</>}</main>;
}

function Applications({auth,notify}:{auth:any;notify:any}){
  const [,setLocation]=useLocation();
  const [refresh,setRefresh]=useState(0);const [briefMap,setBriefMap]=useState<Record<string,Brief>>({});
  const own=useRecords<any>('applications',auth.profile?.role==='creator'?{column:'creator_id',value:auth.session?.user?.id,order:'created_at'}:undefined);
  const brandBriefs=useRecords<Brief>('briefs',{column:'brand_id',value:auth.session?.user?.id});
  useEffect(()=>{if(!supabase||!auth.profile||auth.profile.role!=='brand'||!brandBriefs.records.length)return;supabase.from('applications').select('*').in('brief_id',brandBriefs.records.map(b=>b.id)).then(({data})=>{if(data)setBrandMap(data as any[])});},[auth.profile,brandBriefs.records,refresh]);
  const [brandMap,setBrandMap]=useState<any[]>([]);
  const applications=auth.profile?.role==='brand'?brandMap:own.records;
  const briefIds=Array.from(new Set(applications.map(a=>a.brief_id).filter(Boolean)));
  useEffect(()=>{if(!supabase||!briefIds.length)return;supabase.from('briefs').select('*').in('id',briefIds).then(({data})=>{if(data)setBriefMap(Object.fromEntries(data.map((b:any)=>[b.id,b])));});},[applications.length,briefIds.join(',')]);
  const changeStatus=async(app:any,status:string)=>{if(!supabase)return notify('Supabase is not configured.','error');const {error}=await supabase.from('applications').update({status}).eq('id',app.id);if(error)return notify(error.message,'error');if(status==='accepted'&&auth.session){const existing=await supabase.from('engagements').select('id').eq('brief_id',app.brief_id).eq('creator_id',app.creator_id).maybeSingle();if(existing.error)return notify(`Application accepted, but workspace lookup failed: ${existing.error.message}`,'error');if(!existing.data){const brief=brandBriefs.records.find((b:Brief)=>b.id===app.brief_id);const{data,error:createError}=await supabase.from('engagements').insert({brief_id:app.brief_id,brand_id:auth.session.user.id,creator_id:app.creator_id,status:'in_progress',current_stage:'Kickoff',agreed_budget:app.proposed_price??null,agreed_deadline:brief?.deadline??null}).select('id').single();if(createError)return notify(`Application accepted, but workspace creation failed: ${createError.message}`,'error');notify('Application accepted. The collaboration workspace is ready.');if(data?.id)setLocation(`/workspace/${data.id}`);return;}}notify(`Application ${status}.`);setRefresh(x=>x+1);void own.reload();};
  const invite=async(creatorId:string,briefId:string)=>{if(!supabase||!auth.session)return notify('Sign in as a brand to invite creators.','error');const {error}=await supabase.from('invitations').insert({brief_id:briefId,brand_id:auth.session.user.id,creator_id:creatorId,message:'We would like to invite you to discuss this brief.',status:'pending'});notify(error?.message||'Invitation sent.',error?'error':'success');};
  if(!auth.profile)return <main className="page"><div className="page-title"><div><div className="eyebrow">Your work</div><h1>Applications</h1></div></div><AuthGate message="Sign in to review your applications or applicants."/></main>;
  return <main className="page animate-in"><div className="page-title"><div><div className="eyebrow">Your work</div><h1>{auth.profile.role==='brand'?'Applicant review':'Applications'}</h1><p>{auth.profile.role==='brand'?'Review proposals, shortlist and invite creators.':'Track the status of your applications.'}</p></div><button className="button" onClick={()=>{setRefresh(x=>x+1);void own.reload();void brandBriefs.reload();}}><ArrowDown size={14}/>Refresh</button></div>{(own.loading&&auth.profile.role==='creator')||brandBriefs.loading&&auth.profile.role==='brand'?<ProjectSkeletons/>:applications.length?<div className="list-stack">{applications.map((a:any)=><div className="panel" key={a.id}><div className="row between"><div><span className="pill">{a.status||'pending'}</span><h3 style={{margin:'10px 0 3px'}}>{briefMap[a.brief_id]?.title||'Brief application'}</h3><span className="muted">{auth.profile.role==='brand'?`Creator ${a.creator_id}`:`Submitted ${a.created_at?new Date(a.created_at).toLocaleDateString():'recently'}`}</span></div><span className="muted">{a.proposed_price!=null?`Proposed ${a.proposed_price}`:''}</span></div><p className="muted" style={{fontSize:12,lineHeight:1.6}}>{a.proposal||'No proposal text was included.'}</p>{auth.profile.role==='brand'&&<div className="row" style={{flexWrap:'wrap'}}><Link href={`/creators/${a.creator_id}`} className="button small">View creator</Link><button className="button small" onClick={()=>invite(a.creator_id,a.brief_id)}>Invite</button><button className="button small" onClick={()=>changeStatus(a,'shortlisted')}>Shortlist</button><button className="button primary small" onClick={()=>changeStatus(a,'accepted')}>Accept & create engagement</button><button className="button small" onClick={()=>changeStatus(a,'declined')}>Decline</button></div>}</div>)}</div>:<EmptyState title={auth.profile.role==='brand'?'No applications yet':'No applications sent yet'} text={own.error||'Applications submitted by creators will appear here for review.'} action={auth.profile.role==='brand'?'Review briefs':'Find a project'} href={auth.profile.role==='brand'?'/dashboard':'/projects'}/>}</main>;
}

function Invitations({auth,notify}:{auth:any;notify:any}){
  const invitations=useRecords<any>('invitations',auth.session?{column:auth.profile?.role==='brand'?'brand_id':'creator_id',value:auth.session.user.id,order:'created_at'}:undefined);
  const update=async(id:string,status:string)=>{if(!supabase)return;const{error}=await supabase.from('invitations').update({status}).eq('id',id);notify(error?.message||`Invitation ${status}.`,error?'error':'success');void invitations.reload();};
  if(!auth.profile)return <main className="page"><div className="page-title"><div><div className="eyebrow">Inbox</div><h1>Invitations</h1></div></div><AuthGate message="Sign in to see creator invitations and brand outreach."/></main>;
  return <main className="page"><div className="page-title"><div><div className="eyebrow">Your inbox</div><h1>Invitations</h1><p>Briefs and invitations shared directly with you.</p></div></div>{invitations.loading?<ProjectSkeletons/>:invitations.records.length?<div className="list-stack">{invitations.records.map((i:any)=><div className="panel" key={i.id}><div className="row between"><div><span className="pill">{i.status}</span><h3>Creative brief invitation</h3><p className="muted">{i.message||'You have been invited to discuss a brief.'}</p></div><div className="row"><Link className="button small" href={i.brief_id?`/projects/${i.brief_id}`:'/projects'}>View brief</Link>{auth.profile.role==='creator'&&i.status==='pending'&&<><button className="button primary small" onClick={()=>update(i.id,'accepted')}>Accept</button><button className="button small" onClick={()=>update(i.id,'declined')}>Decline</button></>}</div></div></div>)}</div>:<EmptyState title="Your inbox is clear" text={invitations.error||'Brand invitations will show up here when a team wants to connect about a brief.'} action="Explore projects" href="/projects"/>}</main>;
}

function Dashboard({auth,notify}:{auth:any;notify:any}){
  const briefs=useRecords<Brief>('briefs',auth.session?{column:'brand_id',value:auth.session.user.id,order:'created_at'}:undefined);
  const apps=useRecords<any>('applications',auth.session&&auth.profile?.role==='creator'?{column:'creator_id',value:auth.session.user.id,order:'created_at'}:undefined);
  const invitations=useRecords<any>('invitations',auth.session?{column:auth.profile?.role==='brand'?'brand_id':'creator_id',value:auth.session.user.id}:undefined);
  const portfolio=useRecords<any>('portfolio_items',auth.session?{column:'creator_id',value:auth.session.user.id}:undefined);
  const engagements=useRecords<any>('engagements',auth.session?{column:auth.profile?.role==='brand'?'brand_id':'creator_id',value:auth.session.user.id,order:'created_at'}:undefined);
  const [brandApplications,setBrandApplications]=useState<any[]>([]);
  useEffect(()=>{if(!supabase||auth.profile?.role!=='brand'||!briefs.records.length){setBrandApplications([]);return;}supabase.from('applications').select('*').in('brief_id',briefs.records.map(b=>b.id)).then(({data})=>{if(data)setBrandApplications(data as any[])});},[auth.profile?.role,briefs.records]);
  if(!auth.profile)return <main className="page"><AuthGate message="Sign in to open your role-specific workspace."/></main>;
  if(!auth.profile.role)return <main className="page"><EmptyState title="You're signed in" text="Your Supabase session is active, but this account has no creator or brand role in its profile metadata yet. Marketplace actions need a saved profile." action="Back to home" href="/"/></main>;
  const brand=auth.profile.role==='brand';
  return <main className="page animate-in"><div className="page-title"><div><div className="eyebrow">{brand?'Brand studio':'Creator studio'}</div><h1>Good to see you, {auth.profile.full_name?.split(' ')[0]||'there'}.</h1><p>{brand?'Keep briefs, candidates and collaborations moving.':'Find your next collaboration and keep your work visible.'}</p></div><Link className="button primary" href={brand?'/briefs/new':'/portfolio'}>{brand?<><FilePlus2 size={14}/>New brief</>:<><ImagePlus size={14}/>Edit portfolio</>}</Link></div>
    <div className="steps-grid">{(brand?[['Published briefs',briefs.records.length,'/briefs/new'],['Applications',brandApplications.length,'/applications'],['Invitations',invitations.records.length,'/invitations'],['Active work',engagements.records.length,'/applications']]:[['Applications',apps.records.length,'/applications'],['Invitations',invitations.records.length,'/invitations'],['Portfolio items',portfolio.records.length,'/portfolio'],['Active work',engagements.records.length,'/applications']]).map(([title,value,href]:any,i)=><Link className="step-card dashboard-stat" key={title} href={href}><div className="step-icon">{[<FilePlus2 size={17}/>,<UsersRound size={17}/>,<Bell size={17}/>,<BriefcaseBusiness size={17}/>][i]}</div><small>{title}</small><strong>{value}</strong></Link>)}</div>
    {brand ? (
      <section className="section">
        <div className="section-head"><div><h2>Your briefs</h2><p>Only your own briefs are shown here.</p></div><Link href="/briefs/new" className="text-link">Create brief <ArrowRight size={14}/></Link></div>
        {briefs.loading ? <ProjectSkeletons/> : briefs.records.length ? <div className="list-stack">{briefs.records.map(b=><div className="project-card" key={b.id}><div style={{flex:1}}><span className="pill">{b.status}</span><h3 style={{marginTop:10}}>{b.title}</h3><span className="muted">{b.content_type||'Creative brief'}</span></div><div className="row"><Link href={`/briefs/${b.id}/matches`} className="button primary small">Creator matches</Link><Link href="/applications" className="button small">Applicants</Link></div></div>)}</div> : <EmptyState title="No briefs published yet" text={briefs.error||'Build a brief to start meeting creators.'} action="Create your first brief" href="/briefs/new"/>}
      </section>
    ) : (
      <section className="section"><div className="section-head"><div><h2>Keep your creator profile ready</h2><p>A complete portfolio gives brands more to evaluate than a match score can.</p></div></div><div className="panel row between"><div><h3 style={{margin:'0 0 5px'}}>Your portfolio</h3><span className="muted">{portfolio.records.length} published items</span></div><Link className="button primary" href="/portfolio">Manage portfolio <ArrowRight size={14}/></Link></div></section>
    )}
    <section className="section"><div className="section-head"><div><h2>Active collaborations</h2><p>Shared workspaces created after a brand accepts an application.</p></div></div>{engagements.loading?<ProjectSkeletons/>:engagements.records.length?<div className="list-stack">{engagements.records.map((e:any)=><Link href={`/workspace/${e.id}`} className="project-card" key={e.id}><div><span className="pill">{e.current_stage||e.status}</span><h3 style={{marginTop:9}}>Brief {e.brief_id}</h3><span className="muted">Agreed budget {e.agreed_budget??'not listed'} · Deadline {e.agreed_deadline||'not listed'}</span></div><ArrowRight size={16}/></Link>)}</div>:<EmptyState title="No active collaborations" text={engagements.error||'Once a creator application is accepted, both sides can use a shared workspace for stages, versions and review.'}/>}</section>
    <section className="section"><div className="section-head"><div><h2>Quick access</h2><p>Things you may want to pick up next.</p></div></div><div className="quick-links"><Link href="/applications"><UsersRound size={16}/> Applications <ArrowRight size={14}/></Link><Link href="/invitations"><Bell size={16}/> Invitations <ArrowRight size={14}/></Link><Link href="/assistant"><WandSparkles size={16}/> Brief assistant <ArrowRight size={14}/></Link></div></section>
  </main>;
}

function AccountProfile({auth,notify}:{auth:any;notify:any}){
  const [values,setValues]=useState({full_name:auth.profile?.full_name||'',company_name:auth.profile?.company_name||'',industry:auth.profile?.industry||'',location:auth.profile?.location||'',bio:auth.profile?.bio||'',is_public:auth.profile?.is_public??true});
  const [busy,setBusy]=useState(false);
  useEffect(()=>setValues({full_name:auth.profile?.full_name||'',company_name:auth.profile?.company_name||'',industry:auth.profile?.industry||'',location:auth.profile?.location||'',bio:auth.profile?.bio||'',is_public:auth.profile?.is_public??true}),[auth.profile]);
  const save=async(event:FormEvent)=>{
    event.preventDefault();
    if(!supabase||!auth.session)return notify('Sign in to update your profile.','error');
    setBusy(true);
    try{
      const{data,error}=await supabase.from('profiles').update({
        full_name:values.full_name.trim(),
        company_name:auth.profile.role==='brand'?values.company_name.trim():auth.profile.company_name||null,
        industry:auth.profile.role==='brand'?values.industry.trim():auth.profile.industry||null,
        location:values.location.trim(),
        bio:values.bio.trim(),
        is_public:values.is_public,
      }).eq('id',auth.session.user.id).select(profileColumns).maybeSingle();
      if(error)throw error;
      if(data)auth.setProfile(data as Profile);
      notify('Profile updated.');
    }catch(error){notify(error instanceof Error?error.message:'Profile update failed.','error')}
    finally{setBusy(false)}
  };
  if(auth.profileUnavailable||!auth.profile?.role)return <main className="page"><EmptyState title="Profile details are unavailable" text="The Supabase profile record could not be loaded. Check that the marketplace migration has been applied." action="Return to workspace" href="/dashboard"/></main>;
  return <main className="page animate-in">
    <div className="page-title"><div><div className="eyebrow">Account settings</div><h1>My profile</h1><p>Keep your marketplace identity current.</p></div><Link className="button" href={auth.profile.role==='creator'?'/portfolio':'/dashboard'}>{auth.profile.role==='creator'?'Creator details & portfolio':'Workspace'}<ArrowRight size={14}/></Link></div>
    <form className="panel" onSubmit={save}>
      <div className="form-grid">
        <Field label="Full name"><input required maxLength={120} value={values.full_name} onChange={event=>setValues({...values,full_name:event.target.value})}/></Field>
        {auth.profile.role==='brand'&&<Field label="Company or agency"><input required maxLength={160} value={values.company_name} onChange={event=>setValues({...values,company_name:event.target.value})}/></Field>}
        {auth.profile.role==='brand'&&<Field label="Industry"><input maxLength={120} value={values.industry} onChange={event=>setValues({...values,industry:event.target.value})} placeholder="Fashion, technology, creative services…"/></Field>}
        <Field label="Location"><input maxLength={120} value={values.location} onChange={event=>setValues({...values,location:event.target.value})} placeholder="City, country or remote"/></Field>
        <Field label="About" full><textarea maxLength={2000} value={values.bio} onChange={event=>setValues({...values,bio:event.target.value})} placeholder="Share a short introduction."/></Field>
        <label className="checkline field full"><input type="checkbox" checked={values.is_public} onChange={event=>setValues({...values,is_public:event.target.checked})}/> Make my profile visible in marketplace discovery</label>
      </div>
      <div className="form-actions"><span className="muted">Your account email is managed by Supabase Auth.</span><button className="button primary" disabled={busy}>{busy?'Saving…':'Save profile'}<Check size={14}/></button></div>
    </form>
  </main>;
}

function Notifications({auth,notify}:{auth:any;notify:any}){
  const records=useRecords<any>('notifications',{column:'user_id',value:auth.session?.user?.id,order:'created_at'});
  const unread=records.records.filter(item=>!item.is_read);
  const markRead=async(id:string)=>{
    if(!supabase||!auth.session)return;
    const{error}=await supabase.from('notifications').update({is_read:true}).eq('id',id).eq('user_id',auth.session.user.id);
    if(error)notify(error.message,'error');else void records.reload();
  };
  const markAllRead=async()=>{
    if(!supabase||!auth.session||!unread.length)return;
    const{error}=await supabase.from('notifications').update({is_read:true}).eq('user_id',auth.session.user.id).eq('is_read',false);
    if(error)notify(error.message,'error');else void records.reload();
  };
  return <main className="page animate-in">
    <div className="page-title"><div><div className="eyebrow">Your workspace</div><h1>Notifications</h1><p>Marketplace updates for your account.</p></div>{unread.length>0&&<button className="button" onClick={markAllRead}>Mark all read</button>}</div>
    {records.loading?<ProjectSkeletons/>:records.error?<EmptyState title="Notifications are unavailable" text={records.error}/>:records.records.length===0?<EmptyState title="You're all caught up" text="New applications, invitations and collaboration updates will appear here."/>:
      <div className="list-stack">{records.records.map(item=><article className={`panel notification-item ${item.is_read?'read':''}`} key={item.id}>
        <div className="row between"><div><div className="row"><span className="notification-mark"><Bell size={15}/></span><strong>{item.title}</strong>{!item.is_read&&<span className="pill">New</span>}</div><p className="muted" style={{margin:'8px 0 0'}}>{item.message}</p><small className="muted">{item.created_at?new Date(item.created_at).toLocaleString():''}</small></div>
          {!item.is_read&&<button className="button small" onClick={()=>void markRead(item.id)}>Mark read</button>}
        </div>
      </article>)}</div>}
  </main>;
}

function Portfolio({auth,notify}:{auth:any;notify:any}){
  const items=useRecords<any>('portfolio_items',auth.session?{column:'creator_id',value:auth.session.user.id,order:'created_at'}:undefined);
  const [creatorData,setCreatorData]=useState({headline:'',bio:'',specializations:'',skills:'',ai_tools:'',ai_models:'',content_types:'',supported_formats:'',aspect_ratios:'',workflow:'',availability_status:'available',experience_years:'',hourly_rate:'',commercial_use_supported:false});
  const [profileBusy,setProfileBusy]=useState(false);
  useEffect(()=>{if(!supabase||!auth.session)return;supabase.from('creator_profiles').select('*').eq('user_id',auth.session.user.id).maybeSingle().then(({data})=>{if(data)setCreatorData({headline:data.headline||'',bio:data.bio||'',specializations:(data.specializations||[]).join(', '),skills:(data.skills||[]).join(', '),ai_tools:(data.ai_tools||[]).join(', '),ai_models:(data.ai_models||[]).join(', '),content_types:(data.content_types||[]).join(', '),supported_formats:(data.supported_formats||[]).join(', '),aspect_ratios:(data.aspect_ratios||[]).join(', '),workflow:data.workflow||'',availability_status:data.availability_status||'available',experience_years:data.experience_years??'',hourly_rate:data.hourly_rate??'',commercial_use_supported:!!data.commercial_use_supported})})},[auth.session]);
  const saveCreatorProfile=async(e:FormEvent)=>{e.preventDefault();if(!supabase||!auth.session)return;setProfileBusy(true);const payload={user_id:auth.session.user.id,headline:creatorData.headline,bio:creatorData.bio,specializations:csv(creatorData.specializations),skills:csv(creatorData.skills),ai_tools:csv(creatorData.ai_tools),ai_models:csv(creatorData.ai_models),content_types:csv(creatorData.content_types),supported_formats:csv(creatorData.supported_formats),aspect_ratios:csv(creatorData.aspect_ratios),workflow:creatorData.workflow,availability_status:creatorData.availability_status,experience_years:creatorData.experience_years?Number(creatorData.experience_years):null,hourly_rate:creatorData.hourly_rate?Number(creatorData.hourly_rate):null,commercial_use_supported:creatorData.commercial_use_supported};const{error}=await supabase.from('creator_profiles').upsert(payload,{onConflict:'user_id'});setProfileBusy(false);notify(error?.message||'Creator profile updated.',error?'error':'success')};
  const [form,setForm]=useState({title:'',description:'',content_type:'Generative Art',tools:'',models:'',skills:'',specialization:'',workflow:'',format:'',aspect_ratio:'',commercial_use:false,commercial_use_details:'',project_context:'',client_name:'',is_published:true});
  const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [editingId,setEditingId]=useState<string|null>(null);
  const add=async(e:FormEvent)=>{e.preventDefault();if(!auth.session)return notify('Sign in as a creator to manage your portfolio.','error');if(auth.profile?.role!=='creator')return notify('Portfolio management is for creator accounts.','error');if(!supabase)return notify('Supabase is not configured.','error');setBusy(true);let mediaUrl:string|null=null;let mediaType='image';if(file){const path=`${auth.session.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,'_')}`;const{data,error}=await supabase.storage.from('portfolio').upload(path,file,{upsert:false});if(error){setBusy(false);return notify(error.message,'error')}const result=supabase.storage.from('portfolio').getPublicUrl(data.path);mediaUrl=result.data.publicUrl;mediaType=file.type.startsWith('video/')?'video':'image';}const payload:any={creator_id:auth.session.user.id,...form,tools:csv(form.tools),models:csv(form.models),skills:csv(form.skills)};if(file){payload.media_url=mediaUrl;payload.media_type=mediaType;}else if(!editingId){payload.media_url=null;payload.media_type='image';}const{error}=editingId?await supabase.from('portfolio_items').update(payload).eq('id',editingId):await supabase.from('portfolio_items').insert(payload);setBusy(false);if(error)notify(error.message,'error');else{notify(editingId?'Portfolio item updated.':'Portfolio item added.');setForm({...form,title:'',description:'',tools:'',models:'',skills:''});setFile(null);setEditingId(null);void items.reload();}};
  const remove=async(id:string)=>{if(!supabase)return;const{error}=await supabase.from('portfolio_items').delete().eq('id',id);notify(error?.message||'Portfolio item removed.',error?'error':'success');void items.reload();};
  if(!auth.profile)return <main className="page"><div className="page-title"><div><div className="eyebrow">Creator studio</div><h1>Portfolio</h1></div></div><AuthGate message="Sign in as a creator to add and publish portfolio work."/></main>;
  if(auth.profile.role!=='creator')return <main className="page"><EmptyState title="Creator portfolio management" text="Portfolio items are managed from creator accounts." action="Dashboard" href="/dashboard"/></main>;
  return <main className="page animate-in"><div className="page-title"><div><div className="eyebrow">Your point of view</div><h1>Portfolio studio</h1><p>Show process and context, not just the final frame.</p></div><span className="pill">{items.records.length} items</span></div>
    <form className="panel creator-profile-form" onSubmit={saveCreatorProfile}><div className="section-head"><div><h2>Creator profile</h2><p>These details power discovery and the transparent match breakdown.</p></div><button disabled={profileBusy} className="button primary small">{profileBusy?'Saving…':'Save profile'}</button></div><div className="form-grid"><Field label="Professional headline" full><input value={creatorData.headline} onChange={e=>setCreatorData({...creatorData,headline:e.target.value})} placeholder="AI filmmaker · motion artist · visual storyteller"/></Field><Field label="About your practice" full><textarea value={creatorData.bio} onChange={e=>setCreatorData({...creatorData,bio:e.target.value})} placeholder="Describe your creative approach and collaboration style."/></Field><Field label="Specializations"><input value={creatorData.specializations} onChange={e=>setCreatorData({...creatorData,specializations:e.target.value})} placeholder="Comma-separated"/></Field><Field label="Skills"><input value={creatorData.skills} onChange={e=>setCreatorData({...creatorData,skills:e.target.value})} placeholder="Comma-separated"/></Field><Field label="AI tools"><input value={creatorData.ai_tools} onChange={e=>setCreatorData({...creatorData,ai_tools:e.target.value})} placeholder="Comma-separated"/></Field><Field label="AI models"><input value={creatorData.ai_models} onChange={e=>setCreatorData({...creatorData,ai_models:e.target.value})} placeholder="Comma-separated"/></Field><Field label="Content types"><input value={creatorData.content_types} onChange={e=>setCreatorData({...creatorData,content_types:e.target.value})} placeholder="Comma-separated"/></Field><Field label="Supported formats"><input value={creatorData.supported_formats} onChange={e=>setCreatorData({...creatorData,supported_formats:e.target.value})} placeholder="Comma-separated"/></Field><Field label="Aspect ratios"><input value={creatorData.aspect_ratios} onChange={e=>setCreatorData({...creatorData,aspect_ratios:e.target.value})} placeholder="16:9, 9:16"/></Field><Field label="Availability"><select value={creatorData.availability_status} onChange={e=>setCreatorData({...creatorData,availability_status:e.target.value})}><option value="available">Available</option><option value="limited">Limited availability</option><option value="unavailable">Unavailable</option></select></Field><Field label="Experience (years)"><input type="number" min="0" value={creatorData.experience_years} onChange={e=>setCreatorData({...creatorData,experience_years:e.target.value})}/></Field><Field label="Hourly rate (optional)"><input type="number" min="0" value={creatorData.hourly_rate} onChange={e=>setCreatorData({...creatorData,hourly_rate:e.target.value})}/></Field><Field label="Workflow" full><textarea value={creatorData.workflow} onChange={e=>setCreatorData({...creatorData,workflow:e.target.value})} placeholder="How do you move from concept to delivery?"/></Field><label className="checkline field full"><input type="checkbox" checked={creatorData.commercial_use_supported} onChange={e=>setCreatorData({...creatorData,commercial_use_supported:e.target.checked})}/> I support commercial-use engagements (terms agreed per project)</label></div></form>
    <div className="content-grid" style={{gridTemplateColumns:'1fr 1.05fr',marginTop:17}}><section className="panel"><h3 style={{marginTop:0}}>{editingId?'Edit portfolio item':'Add a portfolio item'}</h3><form onSubmit={add}><div className="form-grid"><Field label="Title" full><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Give the work a name"/></Field><Field label="Description" full><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What did you make, and how?"/></Field><Field label="Content type"><input value={form.content_type} onChange={e=>setForm({...form,content_type:e.target.value})}/></Field><Field label="Specialization"><input value={form.specialization} onChange={e=>setForm({...form,specialization:e.target.value})} placeholder="Optional"/></Field><Field label="Tools"><input value={form.tools} onChange={e=>setForm({...form,tools:e.target.value})} placeholder="Comma-separated"/></Field><Field label="Models"><input value={form.models} onChange={e=>setForm({...form,models:e.target.value})} placeholder="Comma-separated"/></Field><Field label="Skills"><input value={form.skills} onChange={e=>setForm({...form,skills:e.target.value})} placeholder="Comma-separated"/></Field><Field label="Format"><input value={form.format} onChange={e=>setForm({...form,format:e.target.value})} placeholder="MP4, PNG, etc."/></Field><Field label="Aspect ratio"><input value={form.aspect_ratio} onChange={e=>setForm({...form,aspect_ratio:e.target.value})} placeholder="16:9"/></Field><Field label="Client name"><input value={form.client_name} onChange={e=>setForm({...form,client_name:e.target.value})} placeholder="Optional"/></Field><Field label="Project context" full><textarea value={form.project_context} onChange={e=>setForm({...form,project_context:e.target.value})} placeholder="Context that helps brands understand the work"/></Field><Field label="Asset file" full><input type="file" accept="image/*,video/*" onChange={e=>setFile(e.target.files?.[0]||null)}/><span className="hint">Stored in Supabase Storage bucket: portfolio. Leave blank to keep the existing asset.</span></Field><label className="checkline field full"><input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form,is_published:e.target.checked})}/> Publish this work on my profile</label></div><div className="row" style={{marginTop:15}}><button disabled={busy} className="button primary">{busy?'Saving…':editingId?'Save changes':'Add portfolio item'}<Upload size={14}/></button>{editingId&&<button type="button" className="button" onClick={()=>{setEditingId(null);setForm({...form,title:'',description:'',tools:'',models:'',skills:''})}}>Cancel edit</button>}</div></form></section><section><div className="section-head"><div><h2>Published work</h2><p>Portfolio records from your account.</p></div></div>{items.loading?<SkeletonGrid/>:items.error?<EmptyState title="Portfolio could not load" text={items.error}/>:items.records.length?<div className="portfolio-management">{items.records.map((i:any)=><div className="panel row between" key={i.id}><div className="row"><div className="portfolio-thumb" style={i.thumbnail_url?{backgroundImage:`url(${i.thumbnail_url})`}:{}}><FileImage size={19}/></div><div><strong>{i.title}</strong><div className="muted">{i.content_type||'Work'} · {i.is_published?'Published':'Draft'}</div></div></div><div className="row"><button className="button small" onClick={()=>{setEditingId(i.id);setForm({...form,title:i.title||'',description:i.description||'',content_type:i.content_type||'',tools:(i.tools||[]).join(', '),models:(i.models||[]).join(', '),skills:(i.skills||[]).join(', '),specialization:i.specialization||'',workflow:i.workflow||'',format:i.format||'',aspect_ratio:i.aspect_ratio||'',commercial_use:!!i.commercial_use,commercial_use_details:i.commercial_use_details||'',project_context:i.project_context||'',client_name:i.client_name||'',is_published:!!i.is_published});}}>Edit</button><button className="button small" onClick={()=>remove(i.id)} aria-label={`Delete ${i.title}`}>Remove</button></div></div>)}</div>:<EmptyState title="Your portfolio starts here" text="Add a published item to show brands what you can make."/>}</section></div></main>;
}

function Workspace({auth,notify}:{auth:any;notify:any}){
  const {id}=useParams<{id:string}>();const {record:engagement,loading,error,reload}=useRecord<any>('engagements',id);const deliverables=useRecords<any>('deliverables',{column:'engagement_id',value:id,order:'created_at'});const revisions=useRecords<any>('revisions',{column:'engagement_id',value:id,order:'created_at'});
  const [file,setFile]=useState<File|null>(null);const[title,setTitle]=useState('');const[description,setDescription]=useState('');const[comment,setComment]=useState('');const[busy,setBusy]=useState(false);
  const stageNames=['Kickoff','Production','Review','Complete'];const current=stageNames.indexOf(engagement?.current_stage||'Kickoff');
  const changeStage=async(next:string)=>{if(!supabase)return;const{error:issue}=await supabase.from('engagements').update({current_stage:next,status:next==='Complete'?'completed':'in_progress'}).eq('id',id);notify(issue?.message||`Stage moved to ${next}.`,issue?'error':'success');void reload();};
  const submit=async(e:FormEvent)=>{e.preventDefault();if(!auth.session)return notify('Sign in to submit a deliverable.','error');if(!file)return notify('Choose a file first.','error');if(!supabase)return notify('Supabase is not configured.','error');setBusy(true);const path=`${id}/${auth.session.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,'_')}`;const{data,error:upErr}=await supabase.storage.from('deliverables').upload(path,file);if(upErr){setBusy(false);return notify(upErr.message,'error')}const url=supabase.storage.from('deliverables').getPublicUrl(data.path).data.publicUrl;const version=deliverables.records.reduce((m,d)=>Math.max(m,d.version||0),0)+1;const{error:issue}=await supabase.from('deliverables').insert({engagement_id:id,creator_id:auth.session.user.id,title:title||file.name,file_url:url,version,description,notes:'',status:'submitted'});setBusy(false);notify(issue?.message||`Version ${version} submitted.`,issue?'error':'success');if(!issue){setFile(null);setTitle('');setDescription('');void deliverables.reload();}};
  const review=async(deliverable:any,status:string)=>{if(!supabase)return;const{error:issue}=await supabase.from('deliverables').update({status}).eq('id',deliverable.id);notify(issue?.message||`Deliverable ${status}.`,issue?'error':'success');if(!issue&&status==='revision_requested'){await supabase.from('revisions').insert({engagement_id:id,deliverable_id:deliverable.id,requested_by:auth.session.user.id,comment:comment||'Please revise this delivery.',status:'open'});setComment('');void revisions.reload()}void deliverables.reload();};
  if(!auth.profile)return <main className="page"><AuthGate message="Sign in to open an engagement workspace."/></main>;
  if(loading)return <main className="page"><ProjectSkeletons/></main>;
  if(!engagement)return <main className="page"><EmptyState title="Workspace unavailable" text={error||'This engagement could not be found or you do not have access.'} action="Dashboard" href="/dashboard"/></main>;
  return <main className="page animate-in"><div className="page-title"><div><div className="eyebrow">Collaboration workspace</div><h1>Engagement room</h1><p>Move the work forward with clear stages and versioned delivery.</p></div><span className="pill">{engagement.status||'in progress'}</span></div><div className="panel"><div className="row between"><div><span className="muted">Brief</span><h3>{engagement.brief_id}</h3></div><div className="row"><span className="muted">Budget agreed</span><strong>{engagement.agreed_budget??'Not set'}</strong><span className="muted">Deadline</span><strong>{engagement.agreed_deadline||'Not set'}</strong></div></div><div className="workspace-stages">{stageNames.map((s,i)=><div className={`stage ${i<=current?'active':''}`} key={s}><span className="stage-dot">{i<current?<Check size={13}/>:i+1}</span>{s}{i<stageNames.length-1&&<span className="stage-line"/>}</div>)}</div><div className="row between"><span className="muted">Both sides can move the engagement stage forward.</span><div className="row">{current<stageNames.length-1&&<button className="button primary small" onClick={()=>changeStage(stageNames[current+1]||'Complete')}>Move to {stageNames[current+1]} <ArrowRight size={13}/></button>}{current>0&&<button className="button small" onClick={()=>changeStage(stageNames[current-1] ?? 'Kickoff')}>Previous stage</button>}</div></div></div>
    <div className="content-grid" style={{gridTemplateColumns:'1fr 330px',marginTop:20}}><section><div className="section-head"><div><h2>Deliverables</h2><p>Every delivery is a new version stored in Supabase Storage.</p></div></div>{deliverables.loading?<ProjectSkeletons/>:deliverables.records.length?<div className="list-stack">{deliverables.records.map((d:any)=><div className="panel" key={d.id}><div className="row between"><div><span className="pill">v{d.version} · {d.status}</span><h3>{d.title}</h3></div>{d.file_url&&<a href={d.file_url} target="_blank" rel="noreferrer" className="button small">Open file <ArrowRight size={13}/></a>}</div><p className="muted">{d.description||'No delivery notes.'}</p>{auth.profile.role==='brand'&&<div className="row" style={{flexWrap:'wrap'}}><button className="button primary small" onClick={()=>review(d,'approved')}>Approve</button><input className="revision-input" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Revision request comment"/><button className="button small" onClick={()=>review(d,'revision_requested')}>Request revision</button></div>}</div>)}</div>:<EmptyState title="No files delivered" text="The creator can submit the first file version when production begins."/>}
      {auth.profile.role==='creator'&&<form className="panel" style={{marginTop:15}} onSubmit={submit}><h3>Submit a new version</h3><div className="form-grid"><Field label="Deliverable title"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Campaign hero"/></Field><Field label="File"><input type="file" required onChange={e=>setFile(e.target.files?.[0]||null)}/></Field><Field label="Version notes" full><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="What changed in this version?"/></Field></div><button className="button primary" style={{marginTop:13}} disabled={busy}>{busy?'Uploading…':'Submit version'}<Upload size={14}/></button></form>}
    </section><aside><div className="panel"><h3 style={{marginTop:0}}>Revision history</h3>{revisions.records.length?revisions.records.map((r:any)=><div className="revision-row" key={r.id}><span className="pill">{r.status}</span><p className="muted">{r.comment}</p></div>):<p className="muted">No revision requests yet.</p>}</div><ReviewForm auth={auth} engagement={engagement} notify={notify}/></aside></div>
  </main>;
}
function ReviewForm({auth,engagement,notify}:{auth:any;engagement:any;notify:any}){const[rating,setRating]=useState(5);const[review,setReview]=useState('');const[busy,setBusy]=useState(false);const submit=async(e:FormEvent)=>{e.preventDefault();if(!supabase||!auth.session)return;setBusy(true);const{error}=await supabase.from('reviews').insert({engagement_id:engagement.id,reviewer_id:auth.session.user.id,reviewee_id:auth.session.user.id===engagement.creator_id?engagement.brand_id:engagement.creator_id,rating,review});setBusy(false);notify(error?.message||'Review submitted.',error?'error':'success');if(!error)setReview('')};return <form className="panel" style={{marginTop:13}} onSubmit={submit}><h3 style={{marginTop:0}}>Leave a review</h3><p className="muted">Reviews are available after the engagement is complete.</p><select value={rating} onChange={e=>setRating(Number(e.target.value))} disabled={engagement.status!=='completed'}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select><textarea style={{width:'100%',marginTop:9}} disabled={engagement.status!=='completed'} value={review} onChange={e=>setReview(e.target.value)} placeholder="Share a helpful, specific review."/><button className="button primary small" disabled={engagement.status!=='completed'||busy||!review.trim()} style={{marginTop:8}}>Submit review <Star size={13}/></button></form>}

function Assistant({auth,notify}:{auth:any;notify:any}){
  return <main className="page animate-in"><div className="page-title"><div><div className="eyebrow">Brief companion</div><h1>AI brief assistant</h1><p>Real AI suggestions will appear here when a provider is enabled.</p></div><Link href="/briefs/new" className="button primary">Open brief builder <ArrowRight size={14}/></Link></div><div className="assistant-shell"><aside className="panel assistant-aside"><div className="assistant-badge"><WandSparkles size={21}/></div><h3>Good briefs invite good questions.</h3><p className="muted">Connect the AI provider to get live suggestions on audience, creative direction, deliverables and missing context.</p><div className="assist-topic"><span>01</span> Objective and audience</div><div className="assist-topic"><span>02</span> Deliverables and formats</div><div className="assist-topic"><span>03</span> Explicit usage terms</div></aside><section className="chat-panel"><div className="chat-header"><div className="assistant-badge"><Sparkles size={17}/></div><div><strong>Kampus brief assistant</strong><div className="muted">AI provider not connected</div></div><span className="pill">Disabled</span></div><div className="chat-messages"><div className="assistant-status"><Sparkles size={20}/><h2>Live AI is not enabled</h2><p>This assistant is temporarily unavailable. No prompt is sent, and no generated answer is shown until a provider is connected.</p><p>Using Replit AI can consume workspace credits when people submit requests. The assistant is waiting for your approval before that is enabled.</p></div></div><div className="chat-input"><input disabled placeholder="AI assistant is not connected yet…" aria-label="AI assistant unavailable"/><button className="button primary" disabled aria-label="Send"><Send size={15}/></button></div></section></div></main>;
}

function AuthPage({auth,notify,initialMode}:{auth:any;notify:any;initialMode?:'signin'|'signup'|'reset'|'new-password'}){
  const [mode,setMode]=useState<'signin'|'signup'|'reset'|'new-password'>(initialMode || (new URLSearchParams(window.location.search).get('signup')==='1'?'signup':'signin'));
  const [role,setRole]=useState<'creator'|'brand'>('creator');
  const [specialization,setSpecialization]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [name,setName]=useState('');
  const [company,setCompany]=useState('');
  const [industry,setIndustry]=useState('');
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState('');
  const [demoAccounts,setDemoAccounts]=useState<{email:string;password:string;role:string;name:string}[]>([]);
  const [location,setLocation]=useLocation();
  useEffect(()=>{if(initialMode)setMode(initialMode)},[initialMode]);
  useEffect(()=>{
    if(!import.meta.env.DEV)return;
    let live=true;
    void import('./demo-accounts.json').then(({default:accounts})=>{if(live)setDemoAccounts(accounts)}).catch(error=>console.warn('[Kampus.VC] Development demo account list failed to load:',error));
    return()=>{live=false};
  },[]);
  useEffect(()=>{
    if(auth.session&&auth.profile&&['/auth','/login','/signup'].includes(location)){
      const destination=new URLSearchParams(window.location.search).get('redirect');
      setLocation(destination&&destination.startsWith('/')&&!destination.startsWith('//')?destination:'/dashboard');
    }
  },[auth.session,auth.profile,location,setLocation]);
  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    if(!supabase)return notify('Supabase is not configured for this app yet.','error');
    const normalizedEmail=email.trim().toLowerCase();
    if(mode==='signup'){
      if(!name.trim())return notify('Enter your full name.','error');
      if(password.length<8)return notify('Password must be at least 8 characters.','error');
      if(password!==confirmPassword)return notify('Passwords do not match.','error');
      if(role==='brand'&&!company.trim())return notify('Enter your company or agency name.','error');
      if(role==='creator'&&!specialization)return notify('Choose a creator specialization.','error');
    }
    if(mode==='new-password'){
      if(password.length<8)return notify('Password must be at least 8 characters.','error');
      if(password!==confirmPassword)return notify('Passwords do not match.','error');
    }
    setBusy(true);
    setDone('');
    try{
      if(mode==='new-password'){
        const{data:{session},error:sessionError}=await supabase.auth.getSession();
        if(sessionError)throw sessionError;
        if(!session)throw new Error('reset session expired');
        const{error}=await supabase.auth.updateUser({password});
        if(error)throw error;
        setDone('Your password has been updated. You can now sign in with the new password.');
        setPassword('');
        setConfirmPassword('');
      }else if(mode==='reset'){
        const{error}=await supabase.auth.resetPasswordForEmail(normalizedEmail,{redirectTo:`${window.location.origin}/reset-password`});
        if(error)throw error;
        setDone('If an account uses this email, password reset instructions have been sent.');
      }else if(mode==='signin'){
        const{data,error}=await supabase.auth.signInWithPassword({email:normalizedEmail,password});
        if(error)throw error;
        const{data:profile,error:profileError}=await supabase.from('profiles').select('role').eq('id',data.user.id).maybeSingle();
        if(profileError)throw profileError;
        if(!profile?.role){
          notify('You signed in, but the marketplace profile is not ready. Contact the project administrator.','error');
          setLocation('/dashboard');
          return;
        }
        const requested=new URLSearchParams(window.location.search).get('redirect');
        const fallback=profile.role==='creator'?'/projects':'/dashboard';
        setLocation(requested&&requested.startsWith('/')&&!requested.startsWith('//')?requested:fallback);
      }else{
        const metadata={full_name:name.trim(),role,company_name:role==='brand'?company.trim():null,industry:role==='brand'?industry.trim():null,specialization:role==='creator'?specialization:null};
        const{data,error}=await supabase.auth.signUp({email:normalizedEmail,password,options:{data:metadata}});
        if(error)throw error;
        if(data.user&&data.session){
          const{data:profile,error:profileError}=await supabase.from('profiles').select('role').eq('id',data.user.id).maybeSingle();
          if(profileError)throw profileError;
          if(!profile?.role)throw new Error('profile setup missing');
          setDone('Your account is ready.');
          setLocation(profile.role==='creator'?'/projects':'/dashboard');
        }else{
          setDone('Your account was created. Check your email if confirmation is enabled, then sign in.');
        }
      }
    }catch(error){
      const reason=error instanceof Error?error.message.toLowerCase():'';
      if(reason.includes('reset session expired')){
        notify('This password reset link is invalid or has expired. Request a new reset link.','error');
      }else if(reason.includes('profile setup missing')){
        console.error('[Kampus.VC] Signup completed without a marketplace profile; check the Supabase auth trigger.');
        notify('Unable to finish account setup. The marketplace profile trigger or database migration is not ready.','error');
      }else{
        notify(authErrorMessage(error),'error');
      }
    }finally{
      setBusy(false);
    }
  };
  const switchMode=(next:'signin'|'signup'|'reset'|'new-password')=>{setMode(next);setDone('')};
  return <main className="auth-wrap"><section className="auth-card animate-in">
    <Link href="/" className="brand"><span className="brand-mark"><Sparkles size={15}/></span>Kampus.VC</Link>
    <h1>{mode==='signup'?'Make your next thing.':mode==='reset'?'Reset your password.':mode==='new-password'?'Choose a new password.':'Welcome back.'}</h1>
    <p>{mode==='signup'?'Join a marketplace built for people and AI to make better work.':mode==='reset'?'We will email a secure password reset link.':mode==='new-password'?'Set a new password for your Kampus.VC account.':'Sign in to continue to your creator or brand workspace.'}</p>
    {mode==='signin'&&<div className="alert">If email confirmation is enabled, verify your email before signing in.</div>}
    {!supabase&&<div className="alert">Supabase is not configured. Account access and live data are unavailable.</div>}
    {mode==='signup'&&<>
      <div className="role-toggle"><button type="button" className={role==='creator'?'selected':''} onClick={()=>setRole('creator')}>AI Creator</button><button type="button" className={role==='brand'?'selected':''} onClick={()=>setRole('brand')}>Brand / Business / Agency</button></div>
    </>}
    <form onSubmit={submit}><div className="form-grid">
      {mode==='signup'&&<>
        <Field label="Full name" full><input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your name"/></Field>
        {role==='creator'
          ? <Field label="Creator specialization" full><select required value={specialization} onChange={e=>setSpecialization(e.target.value)}><option value="">Choose your specialization</option>{['AI Filmmaking','AI Animation','Generative Art','AI Video','Motion Graphics','3D','Product Advertising','AI Fashion & Lifestyle'].map(item=><option key={item}>{item}</option>)}</select></Field>
          : <><Field label="Company or agency name" full><input required value={company} onChange={e=>setCompany(e.target.value)} autoComplete="organization" placeholder="Company name"/></Field><Field label="Industry" full><input required value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="e.g. Fashion, technology, creative services"/></Field></>}
      </>}
      {mode!=='new-password'&&<Field label="Email address" full><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com"/></Field>}
      {mode!=='reset'&&<Field label={mode==='new-password'?'New password':'Password'} full><input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signin'?'current-password':'new-password'} placeholder="At least 8 characters"/></Field>}
      {(mode==='new-password'||mode==='signup')&&<Field label="Confirm password" full><input type="password" required minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Enter the password again"/></Field>}
    </div>
      {mode==='signin'&&<button type="button" className="text-link" style={{marginTop:12,border:0,background:'none'}} onClick={()=>switchMode('reset')}>Forgot password?</button>}
      <button className="button primary full" style={{marginTop:17}} disabled={busy||!supabase}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='reset'?'Send reset link':mode==='new-password'?'Update password':'Sign in'}<ArrowRight size={14}/></button>
    </form>
    {done&&<div className="alert success" role="status">{done}</div>}
    {import.meta.env.DEV&&mode==='signin'&&demoAccounts.length>0&&<details className="demo-accounts"><summary>Demo Accounts <span>Development only</span></summary><div className="demo-account-list">{demoAccounts.map(account=><button type="button" className="demo-account" key={account.email} onClick={()=>{setEmail(account.email);setPassword(account.password);setMode('signin')}}><strong>{account.name} · {account.role==='creator'?'Creator':'Brand'}</strong><span>{account.email}</span><code>{account.password}</code></button>)}</div></details>}
    <div className="auth-switch">{mode==='signin'?'New to Kampus.VC?':mode==='signup'?'Already have an account?':'Remembered your password?'} <button type="button" onClick={()=>switchMode(mode==='signup'||mode==='reset'||mode==='new-password'?'signin':'signup')}>{mode==='signin'?'Create account':'Sign in'}</button></div>
    {(mode==='reset'||mode==='new-password')&&<Link className="button full" style={{marginTop:10}} href="/login">Back to sign in</Link>}
  </section></main>;
}

function NotFound(){return <main className="page"><EmptyState title="This page wandered off" text="The route does not exist in this workspace." action="Back to Kampus.VC" href="/"/></main>}

export default App;
