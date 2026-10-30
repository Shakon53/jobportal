import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'

export type AccountRole = 'job_seeker' | 'employer'
export type Category = { id: string; name: string; icon: string }
export type Job = {
  id: string
  title: string
  description: string
  requirements: string
  location: string
  salary: string | null
  job_type: string
  posted_at: string
  deadline: string | null
  categories: { name: string } | null
  employer_profiles: { company_name: string; industry: string | null } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readText(record: Record<string, unknown>, key: string, fallback?: string) {
  const value = record[key]
  if (typeof value === 'string') return value
  if (fallback !== undefined) return fallback
  throw new Error(`A Firestore record is missing the required "${key}" text field.`)
}

function readDate(value: unknown, key: string, optional = false): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString()
  if (optional && (value === null || value === undefined)) return null
  throw new Error(`A Firestore record has an invalid "${key}" date.`)
}

function parseJob(snapshot: QueryDocumentSnapshot<DocumentData>): Job {
  const value: unknown = snapshot.data()
  if (!isRecord(value)) throw new Error(`Job "${snapshot.id}" is not a valid Firestore document.`)

  const rawType = readText(value, 'job_type')
  if (!['full_time', 'part_time', 'contract', 'internship'].includes(rawType)) {
    throw new Error(`Job "${snapshot.id}" has an unsupported job type.`)
  }
  const salary = value.salary
  if (salary !== null && salary !== undefined && typeof salary !== 'string') {
    throw new Error(`Job "${snapshot.id}" has an invalid salary field.`)
  }
  const industry = value.company_industry
  if (industry !== null && industry !== undefined && typeof industry !== 'string') {
    throw new Error(`Job "${snapshot.id}" has an invalid company industry field.`)
  }

  const categoryName = readText(value, 'category_name', '')
  const companyName = readText(value, 'company_name', '')
  return {
    id: snapshot.id,
    title: readText(value, 'title'),
    description: readText(value, 'description'),
    requirements: readText(value, 'requirements', ''),
    location: readText(value, 'location'),
    salary: typeof salary === 'string' ? salary : null,
    job_type: rawType,
    posted_at: readDate(value.posted_at, 'posted_at') ?? '',
    deadline: readDate(value.deadline, 'deadline', true),
    categories: categoryName ? { name: categoryName } : null,
    employer_profiles: companyName
      ? { company_name: companyName, industry: typeof industry === 'string' ? industry : null }
      : null,
  }
}

export async function fetchJobs(database: Firestore): Promise<Job[]> {
  const result = await getDocs(query(
    collection(database, 'jobs'),
    where('is_active', '==', true),
    orderBy('posted_at', 'desc'),
    limit(100),
  ))
  return result.docs.map(parseJob)
}

export async function fetchCategories(database: Firestore): Promise<Category[]> {
  const result = await getDocs(query(collection(database, 'categories'), orderBy('name')))
  return result.docs.map((snapshot) => {
    const value: unknown = snapshot.data()
    if (!isRecord(value)) throw new Error(`Category "${snapshot.id}" is not a valid Firestore document.`)
    return {
      id: snapshot.id,
      name: readText(value, 'name'),
      icon: readText(value, 'icon', ''),
    }
  })
}

export async function createAccountProfile(
  database: Firestore,
  userId: string,
  username: string,
  role: AccountRole,
  companyName: string,
) {
  const batch = writeBatch(database)
  batch.set(doc(database, 'profiles', userId), {
    username,
    role,
    created_at: serverTimestamp(),
  })

  if (role === 'employer') {
    batch.set(doc(database, 'employer_profiles', userId), {
      company_name: companyName,
      industry: '',
    })
  } else {
    batch.set(doc(database, 'job_seeker_profiles', userId), {
      skills: '',
      experience: '',
      education: '',
      resume_path: null,
    })
  }

  await batch.commit()
}

export async function submitApplication(
  database: Firestore,
  jobId: string,
  userId: string,
  coverLetter: string,
): Promise<'submitted' | 'duplicate'> {
  const application = doc(database, 'applications', `${jobId}__${userId}`)
  if ((await getDoc(application)).exists()) return 'duplicate'

  try {
    await setDoc(application, {
      job_id: jobId,
      job_seeker_id: userId,
      cover_letter: coverLetter || null,
      status: 'pending',
      applied_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })
  } catch (error: unknown) {
    if (isRecord(error) && error.code === 'permission-denied' && (await getDoc(application)).exists()) {
      return 'duplicate'
    }
    throw error
  }
  return 'submitted'
}
