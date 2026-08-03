import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !secretKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SECRET_KEY zijn vereist.')
}

const fixtures = [
  {
    name: 'hr-admin',
    email: process.env.TALENT_HR_ADMIN_EMAIL ?? 'hradmin.fixture@liquidhr.test',
    password: process.env.TALENT_HR_ADMIN_PASSWORD,
  },
  {
    name: 'manager',
    email: process.env.TALENT_MANAGER_EMAIL ?? 'manager.fixture@liquidhr.test',
    password: process.env.TALENT_MANAGER_PASSWORD,
  },
  {
    name: 'employee',
    email: process.env.TALENT_EMPLOYEE_EMAIL ?? 'employee.fixture@liquidhr.test',
    password: process.env.TALENT_EMPLOYEE_PASSWORD,
  },
]

const missingPasswords = fixtures.filter((fixture) => !fixture.password).map((fixture) => fixture.name)
if (missingPasswords.length > 0) {
  throw new Error(`Ontbrekende lokale Talent-fixturewachtwoorden voor: ${missingPasswords.join(', ')}.`)
}

const shortPasswords = fixtures.filter((fixture) => (fixture.password?.length ?? 0) < 10).map((fixture) => fixture.name)
if (shortPasswords.length > 0) {
  throw new Error(`Lokale Talent-fixturewachtwoorden moeten minimaal 10 tekens hebben voor: ${shortPasswords.join(', ')}.`)
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})

const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (error) throw new Error(`Auth-gebruikers konden niet worden gelezen: ${error.message}`)

const updated = []
for (const fixture of fixtures) {
  const user = data.users.find((candidate) => candidate.email?.toLowerCase() === fixture.email.toLowerCase())
  if (!user) throw new Error(`Fixturegebruiker niet gevonden: ${fixture.email}`)

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: fixture.password,
    email_confirm: true,
  })
  if (updateError) throw new Error(`Wachtwoord voor ${fixture.name} kon niet worden ingesteld: ${updateError.message}`)

  updated.push(fixture.name)
}

console.log(JSON.stringify({ updated }, null, 2))
