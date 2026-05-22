# 🗺️ FUTURE-CMO AUTHENTICATION - COMPLETE ROADMAP

> **Tech Stack:** Next.js 16 (App Router) · TypeScript · Drizzle ORM · Supabase (PostgreSQL) · TanStack Query · shadcn/ui · React Hook Form · Zod · bcryptjs · JWT

---

## STEP 1: DATABASE SETUP

1. Supabase project তৈরি করুন এবং PostgreSQL connection string নিন (`future_cmo` database)
2. Drizzle schema file এ দুটি table define করুন:
   - **users table** — `username`, `email`, `fullName`, `passwordHash`, `company`, `createdAt`, `updatedAt`
   - **sessions table** — `userId`, `token`, `expiresAt`
3. Drizzle migrations run করুন schema থেকে (`drizzle-kit generate` + `drizzle-kit migrate`)

---

## STEP 2: ZOD VALIDATION SCHEMAS তৈরি করুন

1. **RegisterSchema** তৈরি করুন যেখানে:
   - `username` — 3-20 chars, শুধু alphanumeric + underscore
   - `email` — valid email format
   - `fullName` — minimum 2 chars
   - `password` — 8+ chars, uppercase, number, special character
   - `confirmPassword` — password এর সাথে match হতে হবে
   - `company` — optional field

2. **LoginSchema** তৈরি করুন:
   - `email` — valid format
   - `password` — minimum 1 char
   - `rememberMe` — boolean

3. TypeScript types export করুন এই schemas থেকে

---

## STEP 3: DRIZZLE DATABASE FUNCTIONS তৈরি করুন

1. `findUserByEmail()` — email দিয়ে user খুঁজুন
2. `findUserByUsername()` — username দিয়ে user খুঁজুন
3. `createUser()` — নতুন user insert করুন (hash করে password)
4. `createSession()` — user session create করুন
5. `deleteSession()` — session delete করুন
6. `findUserById()` — id দিয়ে user খুঁজুন

---

## STEP 4: API ENDPOINTS তৈরি করুন

### POST `/api/auth/register`
1. Request body থেকে data নিন
2. Zod schema দিয়ে validate করুন
3. Email uniqueness check করুন (Drizzle query)
4. Username uniqueness check করুন (Drizzle query)
5. যদি duplicate থাকে, **409** error দিন
6. Password hash করুন bcryptjs দিয়ে
7. API key generate করুন (random string)
8. User database এ insert করুন (Drizzle)
9. JWT token generate করুন (7 days expiry)
10. httpOnly cookie তে token set করুন
11. User data + success message return করুন

### POST `/api/auth/login`
1. Request body থেকে email + password নিন
2. Zod schema দিয়ে validate করুন
3. Email দিয়ে user খুঁজুন (Drizzle)
4. যদি user না পাওয়া যায়, **401** error দিন
5. Password compare করুন bcryptjs দিয়ে
6. যদি match না হয়, **401** error দিন
7. JWT token generate করুন
8. Session database তে insert করুন (Drizzle)
9. httpOnly cookie তে token set করুন
10. User data return করুন

### POST `/api/auth/logout`
1. Request এর cookie থেকে token নিন
2. JWT verify করুন
3. Session database থেকে delete করুন (Drizzle)
4. Cookie clear করুন
5. Success message return করুন

### GET `/api/auth/me`
1. Request এর cookie থেকে token নিন
2. JWT verify করুন (যদি expire হয়েছে, **401** দিন)
3. Token থেকে `userId` extract করুন
4. Database থেকে user fetch করুন (Drizzle)
5. User data return করুন (password hash ছাড়া)

---

## STEP 5: TANSTACK QUERY HOOKS তৈরি করুন

### `useRegister()` hook
1. `useMutation` use করুন
2. `mutationFn`: POST `/api/auth/register` কল করুন
3. Request এ Zod validate করা data পাঠান
4. Success এ: queryClient invalidate করুন (`"auth"` queryKey)
5. Error handling: error message দেখান
6. Return: mutation object (`isPending`, `error`, `data`)

### `useLogin()` hook
1. `useMutation` use করুন
2. `mutationFn`: POST `/api/auth/login` কল করুন
3. Success এ: dashboard এ redirect করুন
4. Error handling: invalid credentials message দেখান
5. Return: mutation object

### `useLogout()` hook
1. `useMutation` use করুন
2. `mutationFn`: POST `/api/auth/logout` কল করুন
3. Success এ: সব queries clear করুন (`queryClient.clear()`)
4. Login page এ redirect করুন

### `useCurrentUser()` hook
1. `useQuery` use করুন (`queryKey: ["auth", "currentUser"]`)
2. `queryFn`: GET `/api/auth/me` কল করুন
3. Stale time: 5 minutes set করুন
4. Return: query object (`isLoading`, `error`, `data`)

---

## STEP 6: SHADCN COMPONENTS তৈরি করুন

### RegisterForm Component
1. React Hook Form setup করুন
2. Zod schema resolver add করুন
3. Input fields:
   - `username` (text)
   - `email` (email)
   - `fullName` (text)
   - `password` (password)
   - `confirmPassword` (password)
   - `company` (text, optional)
4. `useRegister()` hook use করুন
5. Form submit এ mutation trigger করুন
6. Loading state: submit button disable করুন
7. Error state: error message display করুন
8. Success state: dashboard redirect করুন
9. shadcn `Button`, `Input`, `Form` components use করুন

### LoginForm Component
1. React Hook Form + Zod setup
2. Input fields:
   - `email`
   - `password`
3. 1টি checkbox: "Remember Me"
4. `useLogin()` hook use করুন
5. Form submit এ mutation call করুন
6. Loading/error/success states handle করুন
7. Success এ dashboard redirect করুন
8. "Forgot Password?" link add করুন (future feature)

### AuthLayout Component
1. shadcn `Card` component use করুন container এর জন্য
2. Logo/branding area add করুন top এ
3. Form area middle এ
4. Footer এ signup/login link
5. Responsive design (mobile friendly)

### ProtectedRoute Component / Middleware
1. `useCurrentUser()` hook দিয়ে current user check করুন
2. যদি loading: spinner দেখান
3. যদি error / no user: login page এ redirect করুন
4. যদি authenticated: children render করুন

---

## STEP 7: PAGES তৈরি করুন

### Login Page (`/login`)
1. AuthLayout এ wrap করুন
2. LoginForm render করুন
3. "Don't have account?" → signup link

### Register Page (`/register`)
1. AuthLayout এ wrap করুন
2. RegisterForm render করুন
3. "Already have account?" → login link

### Dashboard Page (`/dashboard`)
1. ProtectedRoute দিয়ে protect করুন
2. `useCurrentUser()` থেকে user data দেখান
3. Welcome message: `Welcome, [username]!`
4. Logout button add করুন
5. Profile link add করুন (future)

---

## STEP 8: ERROR HANDLING

1. **Validation Errors** — Zod থেকে field-level errors দেখান
2. **Duplicate Errors** — `Email already registered` / `Username taken`
3. **Auth Errors** — `Invalid credentials`
4. **Network Errors** — `Server error, try again`
5. **Token Errors** — Automatically redirect to login যখন token expire হয়

---

## STEP 9: SECURITY CHECKLIST

- [ ] Passwords হ্যাশ করা হয়েছে (bcryptjs)
- [ ] JWT tokens secure (httpOnly cookies তে)
- [ ] CORS properly configured
- [ ] SQL injection থেকে safe (Drizzle parameterized queries)
- [ ] Password validation strong (8+ chars, uppercase, number, special)
- [ ] Rate limiting on auth endpoints (optional)
- [ ] HTTPS enforced in production

---

## STEP 10: TESTING

1. Registration flow test করুন (valid data)
2. Duplicate email/username test করুন
3. Weak password reject হয় কিনা check করুন
4. Login correct credentials দিয়ে test করুন
5. Wrong password দিয়ে test করুন
6. Protected route access করুন (token ছাড়া redirect হওয়া উচিত)
7. Logout করুন + dashboard access করুন (redirect হওয়া উচিত)

---

## NEXT PHASES (এরপর কী করবেন)

1. **Dashboard Layout** — Sidebar + Header navigation
2. **Profile Management** — User info update
3. **Team Management** — Add/remove team members
4. **Claude AI Integration** — Marketing strategy generation
5. **Marketing Framework** — আপনার spreadsheet থেকে data integrate
6. **Analytics Dashboard** — Performance tracking
7. **Content Calendar** — Marketing content planning
