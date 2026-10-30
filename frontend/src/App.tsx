import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, Check, ChevronDown, Clock3, MapPin, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { createUserWithEmailAndPassword, deleteUser, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { firebaseAuth, firebaseConfigError, firebaseConfigured, firestore } from './lib/firebase'
import { createAccountProfile, fetchCategories, fetchJobs, submitApplication, type AccountRole, type Category, type Job } from './lib/firestore'

const demoCategories: Category[] = [
  { id: 'technology', name: 'Technology', icon: '⌘' },
  { id: 'design', name: 'Design', icon: '✳' },
  { id: 'marketing', name: 'Marketing', icon: '↗' },
  { id: 'business', name: 'Business', icon: '◈' },
]

const currentYear = new Date().getFullYear()

const demoJobs: Job[] = [
  {
    id: 'demo-product-designer',
    title: 'Product Designer',
    description: 'Help shape thoughtful digital experiences for a growing product team. You will work closely with product managers and engineers from early concepts through launch.',
    requirements: 'A portfolio of product design work, strong interaction design skills, and clear communication. Experience with Figma and design systems is a plus.',
    location: 'Remote',
    salary: '$90k – $120k',
    job_type: 'full_time',
    posted_at: new Date().toISOString(),
    deadline: null,
    categories: { name: 'Design' },
    employer_profiles: { company_name: 'Northstar Studio', industry: 'Design' },
  },
  {
    id: 'demo-frontend-engineer',
    title: 'Frontend Engineer',
    description: 'Build accessible, fast web experiences and collaborate across the product lifecycle. Join a kind, curious team that values quality and learning.',
    requirements: 'Professional experience building web applications, knowledge of modern JavaScript, and an eye for accessible interfaces.',
    location: 'New York, NY',
    salary: '$110k – $145k',
    job_type: 'full_time',
    posted_at: new Date(Date.now() - 86400000).toISOString(),
    deadline: null,
    categories: { name: 'Technology' },
    employer_profiles: { company_name: 'Brightside', industry: 'Technology' },
  },
  {
    id: 'demo-marketing-intern',
    title: 'Marketing Intern',
    description: 'Support campaigns, research audiences, and help a small team tell a clear story about products people love.',
    requirements: 'Curiosity, thoughtful writing, and an interest in digital marketing. Students and recent graduates are welcome.',
    location: 'Austin, TX',
    salary: '$25 – $30 / hour',
    job_type: 'internship',
    posted_at: new Date(Date.now() - 172800000).toISOString(),
    deadline: null,
    categories: { name: 'Marketing' },
    employer_profiles: { company_name: 'Common Ground', industry: 'Business' },
  },
]

const jobTypes: Record<string, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  internship: 'Internship',
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<AccountRole | null>(null)
  const [username, setUsername] = useState('')
  const isDemoMode = import.meta.env.DEV && !firebaseConfigured
  const [jobs, setJobs] = useState<Job[]>(isDemoMode ? demoJobs : [])
  const [categories, setCategories] = useState<Category[]>(isDemoMode ? demoCategories : [])
  const [loading, setLoading] = useState(firebaseConfigured)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const auth = firebaseAuth
    const database = firestore
    if (!auth || !database) return

    let active = true
    let profileUnsubscribe: (() => void) | undefined
    const authUnsubscribe = onAuthStateChanged(auth, (nextUser) => {
      profileUnsubscribe?.()
      setUser(nextUser)
      setRole(null)
      setUsername('')
      if (!nextUser) return

      profileUnsubscribe = onSnapshot(doc(database, 'profiles', nextUser.uid), (snapshot) => {
        const profile = snapshot.data()
        const nextRole = profile?.role
        setRole(nextRole === 'job_seeker' || nextRole === 'employer' ? nextRole : null)
        setUsername(typeof profile?.username === 'string' ? profile.username : '')
      }, (error: Error) => {
        if (active) setLoadError(error.message)
      })
    }, (error: Error) => {
      if (active) setLoadError(error.message)
    })

    void Promise.all([
      fetchJobs(database),
      fetchCategories(database),
    ]).then(([nextJobs, nextCategories]) => {
      if (!active) return
      setJobs(nextJobs)
      setCategories(nextCategories)
      setLoading(false)
    }).catch((error: unknown) => {
      if (!active) return
      setLoadError(errorMessage(error))
      setLoading(false)
    })

    return () => {
      active = false
      profileUnsubscribe?.()
      authUnsubscribe()
    }
  }, [])

  return (
    <div className="app-shell">
      <Header user={user} username={username} />
      {!firebaseConfigured && (
        <div className={`setup-notice ${import.meta.env.DEV ? '' : 'setup-notice-production'}`}>
          <Sparkles size={16} />
          <span>{firebaseConfigError || (import.meta.env.DEV
            ? 'Preview mode — connect Firebase to enable live jobs, accounts, and applications.'
            : 'This site is being set up. Live jobs and accounts will be available soon.')}</span>
        </div>
      )}
      {loadError && <div className="error-banner" role="alert">{loadError}</div>}
      <Routes>
        <Route path="/" element={<HomePage jobs={jobs} categories={categories} loading={loading} />} />
        <Route path="/jobs" element={<JobsPage jobs={jobs} categories={categories} loading={loading} />} />
        <Route path="/jobs/:id" element={<JobDetailPage jobs={jobs} loading={loading} user={user} role={role} />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <AuthPage mode="signup" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </div>
  )
}

function Header({ user, username }: { user: User | null; username: string }) {
  const [menuOpen, setMenuOpen] = useState(false)

  async function signOut() {
    if (!firebaseAuth) return
    try {
      await firebaseSignOut(firebaseAuth)
    } catch (error: unknown) {
      window.alert(errorMessage(error))
    }
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="JobFly home">
          <span className="brand-mark"><BriefcaseBusiness size={19} strokeWidth={2.5} /></span>
          <span>jobfly<span className="brand-period">.</span></span>
        </Link>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}>
          {menuOpen ? <X size={21} /> : <ChevronDown size={21} />}
        </button>
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`}>
          <NavLink to="/jobs" onClick={() => setMenuOpen(false)}>Find jobs</NavLink>
          <a href="/#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
        </nav>
        <div className={`header-actions ${menuOpen ? 'is-open' : ''}`}>
          {user ? (
            <>
              <span className="signed-in">Hi, {username || user.email?.split('@')[0] || 'there'}</span>
              <button className="button button-outline button-small" onClick={() => void signOut()}>Sign out</button>
            </>
          ) : (
            <>
              <Link className="button button-quiet button-small" to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
              <Link className="button button-primary button-small" to="/signup" onClick={() => setMenuOpen(false)}>Create account</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function HomePage({ jobs, categories, loading }: { jobs: Job[]; categories: Category[]; loading: boolean }) {
  const [keywords, setKeywords] = useState('')
  const [location, setLocation] = useState('')
  const navigate = useNavigate()

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (keywords.trim()) params.set('search', keywords.trim())
    if (location.trim()) params.set('location', location.trim())
    navigate(`/jobs${params.size ? `?${params.toString()}` : ''}`)
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-content">
          <div className="eyebrow eyebrow-light"><Sparkles size={14} /> A better way to find your next role</div>
          <h1>Find work that<br /> <span>moves you forward.</span></h1>
          <p>Good people. Great opportunities. A simpler way to find the work you were meant to do.</p>
          <form className="hero-search" onSubmit={search}>
            <label className="search-field">
              <Search size={19} />
              <input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="Job title or keyword" aria-label="Job title or keyword" />
            </label>
            <span className="search-divider" />
            <label className="search-field location-field">
              <MapPin size={19} />
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City or remote" aria-label="Location" />
            </label>
            <button className="button button-primary search-submit" type="submit">Search jobs <ArrowRight size={17} /></button>
          </form>
          <div className="hero-footnote"><ShieldCheck size={15} /> A thoughtful place to find your next opportunity</div>
        </div>
        <a className="scroll-cue" href="#featured" aria-label="Scroll to featured jobs"><ArrowDown size={17} /></a>
      </section>

      <section className="section section-featured" id="featured">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Handpicked for you</div>
            <h2>Featured opportunities</h2>
            <p>Thoughtful teams looking for their next great teammate.</p>
          </div>
          <Link className="text-link" to="/jobs">Explore all jobs <ArrowRight size={16} /></Link>
        </div>
        {loading ? <LoadingState /> : jobs.length ? (
          <div className="job-grid">
            {jobs.slice(0, 3).map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        ) : <EmptyState title="New opportunities are on the way" text="Check back soon — we’re always adding new roles." />}
      </section>

      <section className="category-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Find your direction</div>
            <h2>Explore by category</h2>
          </div>
          <Link className="text-link" to="/jobs">Browse all <ArrowRight size={16} /></Link>
        </div>
        <div className="category-grid">
          {(categories.length ? categories : import.meta.env.DEV ? demoCategories : []).map((category, index) => (
            <Link key={category.id} className="category-card" to={`/jobs?category=${encodeURIComponent(category.name)}`}>
              <span className={`category-icon category-icon-${index % 4}`}>{category.icon || '✳'}</span>
              <span className="category-name">{category.name}</span>
              <ArrowRight size={16} className="category-arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="how-intro">
          <div className="eyebrow">A little less searching, a lot more finding</div>
          <h2>Your next chapter<br />starts right here.</h2>
          <p>We make the search feel human again, with clear opportunities and a simple way to put yourself forward.</p>
          <Link className="button button-dark" to="/jobs">Explore opportunities <ArrowRight size={17} /></Link>
        </div>
        <div className="steps">
          <div className="step"><span className="step-number">01</span><div><h3>Find your fit</h3><p>Search roles by what matters to you — the work, the place, and the people.</p></div></div>
          <div className="step"><span className="step-number">02</span><div><h3>Make it personal</h3><p>Create an account and introduce yourself to the teams you admire.</p></div></div>
          <div className="step"><span className="step-number">03</span><div><h3>Take the next step</h3><p>Send your application and get one step closer to work that feels right.</p></div></div>
        </div>
      </section>
    </main>
  )
}

function JobsPage({ jobs, categories, loading }: { jobs: Job[]; categories: Category[]; loading: boolean }) {
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const location = params.get('location') ?? ''
  const category = params.get('category') ?? ''

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const query = search.toLowerCase()
    const matchesSearch = !query || `${job.title} ${job.description} ${job.employer_profiles?.company_name ?? ''}`.toLowerCase().includes(query)
    const matchesLocation = !location || job.location.toLowerCase().includes(location.toLowerCase())
    const matchesCategory = !category || job.categories?.name === category
    return matchesSearch && matchesLocation && matchesCategory
  }), [category, jobs, location, search])

  function clearFilters() {
    setParams({})
  }

  return (
    <main className="listing-page">
      <section className="listing-heading">
        <div className="eyebrow">Your next move</div>
        <h1>Find your kind of work.</h1>
        <p>Explore opportunities from teams ready to meet you.</p>
        <ListingSearch key={`${search}\u0000${location}`} search={search} location={location} params={params} setParams={setParams} />
      </section>
      <section className="listing-content">
        <aside className="filter-panel">
          <div className="filter-title">Categories</div>
          <button className={`filter-option ${!category ? 'selected' : ''}`} onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.delete('category'); return next })}>
            <span>All opportunities</span><span className="filter-count">{jobs.length}</span>
          </button>
          {categories.map((item) => (
            <button key={item.id} className={`filter-option ${category === item.name ? 'selected' : ''}`} onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.set('category', item.name); return next })}>
              <span>{item.name}</span>
            </button>
          ))}
          {(search || location || category) && <button className="clear-filters" onClick={clearFilters}>Clear filters <X size={14} /></button>}
        </aside>
        <div className="results">
          <div className="results-toolbar">
            <p><strong>{filteredJobs.length}</strong> {filteredJobs.length === 1 ? 'opportunity' : 'opportunities'} to explore</p>
            <span>Recently posted</span>
          </div>
          {loading ? <LoadingState /> : filteredJobs.length ? (
            <div className="results-grid">{filteredJobs.map((job) => <JobCard key={job.id} job={job} />)}</div>
          ) : <EmptyState title="No roles match those filters" text="Try another search or clear the filters to see every opportunity." action={<button className="button button-outline" onClick={clearFilters}>Clear filters</button>} />}
        </div>
      </section>
    </main>
  )
}

function ListingSearch({ search, location, params, setParams }: {
  search: string
  location: string
  params: URLSearchParams
  setParams: ReturnType<typeof useSearchParams>[1]
}) {
  const [searchValue, setSearchValue] = useState(search)
  const [locationValue, setLocationValue] = useState(location)

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = new URLSearchParams(params)
    if (searchValue.trim()) next.set('search', searchValue.trim())
    else next.delete('search')
    if (locationValue.trim()) next.set('location', locationValue.trim())
    else next.delete('location')
    setParams(next)
  }

  return (
    <form className="listing-search" onSubmit={submitSearch}>
      <label className="search-field"><Search size={18} /><input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Role, company, or keyword" aria-label="Search jobs" /></label>
      <label className="search-field"><MapPin size={18} /><input value={locationValue} onChange={(event) => setLocationValue(event.target.value)} placeholder="City or remote" aria-label="Filter by location" /></label>
      <button className="button button-primary" type="submit">Search <ArrowRight size={16} /></button>
    </form>
  )
}

function JobCard({ job }: { job: Job }) {
  const initials = (job.employer_profiles?.company_name ?? 'J').slice(0, 1).toUpperCase()
  return (
    <article className="job-card">
      <div className="company-avatar">{initials}</div>
      <div className="job-card-content">
        <div className="job-card-topline">
          <span className="job-category">{job.categories?.name ?? 'Opportunity'}</span>
          <span className="job-posted"><Clock3 size={13} /> {timeAgo(job.posted_at)}</span>
        </div>
        <Link className="job-title" to={`/jobs/${job.id}`}>{job.title}</Link>
        <div className="company-name"><Building2 size={14} /> {job.employer_profiles?.company_name ?? 'Company'}</div>
        <div className="job-meta">
          <span><MapPin size={14} />{job.location}</span>
          <span><BriefcaseBusiness size={14} />{jobTypes[job.job_type] ?? job.job_type}</span>
          {job.salary && <span className="salary-meta">{job.salary}</span>}
        </div>
      </div>
      <Link className="job-arrow" to={`/jobs/${job.id}`} aria-label={`View ${job.title}`}><ArrowRight size={18} /></Link>
    </article>
  )
}

function JobDetailPage({ jobs, loading, user, role }: { jobs: Job[]; loading: boolean; user: User | null; role: AccountRole | null }) {
  const { id } = useParams()
  const job = jobs.find((item) => item.id === id)

  if (loading) return <main className="detail-page"><LoadingState /></main>
  if (!job) return <NotFound />

  return (
    <main className="detail-page">
      <Link className="back-link" to="/jobs"><ArrowLeft size={16} /> Back to opportunities</Link>
      <div className="detail-layout">
        <article className="detail-main">
          <div className="detail-company-row">
            <div className="company-avatar company-avatar-large">{(job.employer_profiles?.company_name ?? 'J').slice(0, 1).toUpperCase()}</div>
            <div><span className="job-category">{job.categories?.name ?? 'Opportunity'}</span><div className="company-name">{job.employer_profiles?.company_name ?? 'Company'}</div></div>
          </div>
          <h1>{job.title}</h1>
          <div className="detail-meta">
            <span><MapPin size={16} />{job.location}</span>
            <span><BriefcaseBusiness size={16} />{jobTypes[job.job_type] ?? job.job_type}</span>
            <span><Clock3 size={16} />Posted {timeAgo(job.posted_at)}</span>
          </div>
          {job.salary && <div className="detail-salary">{job.salary}</div>}
          <div className="detail-copy">
            <h2>About the role</h2>
            <p>{job.description}</p>
            <h2>What you’ll bring</h2>
            <p>{job.requirements}</p>
            {job.deadline && <p className="deadline-copy">Apply by {new Date(`${job.deadline}T00:00:00`).toLocaleDateString()}</p>}
          </div>
        </article>
        <ApplyPanel job={job} user={user} role={role} />
      </div>
    </main>
  )
}

function ApplyPanel({ job, user, role }: { job: Job; user: User | null; role: AccountRole | null }) {
  const [coverLetter, setCoverLetter] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firestore || !user) return
    setSubmitting(true)
    setMessage('')
    try {
      const result = await submitApplication(firestore, job.id, user.uid, coverLetter.trim())
      setMessage(result === 'duplicate' ? 'You’ve already applied for this role.' : 'Your application has been sent. Good luck!')
    } catch (submitError: unknown) {
      setMessage(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <aside className="apply-panel">
      <h2>Interested in this role?</h2>
      <p>Take the next step and introduce yourself to the team.</p>
      {!firestore ? (
        <div className="inline-notice">Applications will be enabled once Firebase is connected.</div>
      ) : !user ? (
        <Link className="button button-primary button-full" to="/login">Log in to apply <ArrowRight size={16} /></Link>
      ) : role !== 'job_seeker' ? (
        <div className="inline-notice">Applications are available to job seeker accounts.</div>
      ) : (
        <form className="apply-form" onSubmit={(event) => void apply(event)}>
          <label htmlFor="cover-letter">A note to the team <span>(optional)</span></label>
          <textarea id="cover-letter" value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} rows={5} maxLength={5000} placeholder="Tell them what makes this opportunity interesting to you." />
          <button className="button button-primary button-full" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Submit application'} <ArrowRight size={16} /></button>
          {message && <p className="form-message" role="status">{message}</p>}
        </form>
      )}
      <div className="apply-reassurance"><Check size={15} />Your details are only shared with the hiring team.</div>
    </aside>
  )
}

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate()
  const isSignup = mode === 'signup'
  const [role, setRole] = useState<'job_seeker' | 'employer'>('job_seeker')
  const [username, setUsername] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!firebaseAuth || !firestore) {
      setError(firebaseConfigError || 'Connect Firebase to enable accounts. See the setup instructions in README.md.')
      return
    }
    setSubmitting(true)
    try {
      if (isSignup) {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
        try {
          await createAccountProfile(firestore, credential.user.uid, username.trim(), role, companyName.trim())
        } catch (profileError: unknown) {
          try {
            await deleteUser(credential.user)
          } catch (cleanupError: unknown) {
            await firebaseSignOut(firebaseAuth)
            throw new Error(`Account setup failed: ${errorMessage(profileError)} Account cleanup also failed: ${errorMessage(cleanupError)}`)
          }
          throw profileError
        }
        navigate('/')
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password)
        navigate('/')
      }
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-mark"><BriefcaseBusiness size={22} /></div>
        <div className="eyebrow">{isSignup ? 'A fresh start' : 'Welcome back'}</div>
        <h1>{isSignup ? 'Make your next move.' : 'Good to see you.'}</h1>
        <p className="auth-subtitle">{isSignup ? 'Create an account to introduce yourself to great teams.' : 'Log in to keep moving toward work that feels right.'}</p>
        {isSignup && (
          <div className="role-picker" aria-label="Account type">
            <button type="button" className={role === 'job_seeker' ? 'active' : ''} onClick={() => setRole('job_seeker')}><Users size={16} /> Job seeker</button>
            <button type="button" className={role === 'employer' ? 'active' : ''} onClick={() => setRole('employer')}><Building2 size={16} /> Employer</button>
          </div>
        )}
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {isSignup && <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={40} autoComplete="username" /></label>}
          {isSignup && role === 'employer' && <label>Company name<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required maxLength={120} /></label>}
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={isSignup ? 'new-password' : 'current-password'} /></label>
          {error && <div className="form-alert form-alert-error" role="alert">{error}</div>}
          {message && <div className="form-alert form-alert-success" role="status">{message}</div>}
          <button className="button button-primary button-full" disabled={submitting}>{submitting ? 'Please wait…' : isSignup ? 'Create your account' : 'Log in'} <ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to JobFly?'} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Log in' : 'Create an account'}</Link></p>
        <div className="auth-privacy"><ShieldCheck size={15} />Your information stays private and secure.</div>
      </div>
    </main>
  )
}

function LoadingState() {
  return <div className="loading-state" role="status"><span className="spinner" />Finding opportunities…</div>
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><BriefcaseBusiness size={22} /></span><h3>{title}</h3><p>{text}</p>{action}</div>
}

function NotFound() {
  return <main className="not-found"><span className="eyebrow">404 · Page not found</span><h1>This path didn’t lead anywhere.</h1><p>Let’s get you back to the opportunities.</p><Link className="button button-primary" to="/">Back to home <ArrowRight size={16} /></Link></main>
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <Link className="brand footer-brand" to="/"><span className="brand-mark"><BriefcaseBusiness size={18} /></span><span>jobfly<span className="brand-period">.</span></span></Link>
        <p>Good work starts with a good connection.</p>
        <span className="footer-copy">© {currentYear} JobFly</span>
      </div>
    </footer>
  )
}

function timeAgo(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000))
  if (!Number.isFinite(days) || days < 1) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  return `${Math.floor(days / 7)} ${Math.floor(days / 7) === 1 ? 'week' : 'weeks'} ago`
}

export default App
