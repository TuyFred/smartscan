# Deploy SMARTSCAN
#
# Frontend → Vercel (this folder)
# Backend  → Render (../backend + root render.yaml)

## 1. Backend on Render
1. Push repo to GitHub
2. New Web Service → select repo → Root Directory: `backend`
3. Build: `npm install`
4. Start: `npm start`
5. Set env vars (from backend/.env):
   - FRONTEND_URL=https://your-app.vercel.app
   - CORS_ORIGINS=https://your-app.vercel.app
   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
   - JWT_SECRET (strong random)
   - BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, EMAIL_FROM
   - IOT_API_KEY
6. Note your API URL, e.g. https://smartscan-api.onrender.com

## 2. Frontend on Vercel
1. New Project → import repo → Root Directory: `frontend`
2. Framework: Vite
3. Build: `npm run build`  Output: `dist`
4. Environment variables:
   - VITE_API_URL=https://smartscan-api.onrender.com/api
   - VITE_SOCKET_URL=https://smartscan-api.onrender.com
5. Deploy

## 3. After deploy
- Update Render FRONTEND_URL / CORS_ORIGINS to the Vercel URL
- Redeploy backend if needed
- Test: register → verify email → admin approve → login
