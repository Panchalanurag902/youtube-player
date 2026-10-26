# AllRoundUpdate Video Feed (Cloudflare + GitHub)

Videos aapki site par hi chalti hain. Feed roz GitHub Actions se update hoti hai, live search Cloudflare Worker se.

## Setup (ek baar)
1. GitHub repo mein sab files upload karo. `.github/workflows/daily-feed.yml` file agar upload na ho, to GitHub par **Add file > Create new file** se wahi path likhkar content paste karo.
2. GitHub: **Settings > Secrets and variables > Actions > New repository secret**. Name: `YOUTUBE_API_KEY`, value: aapki YouTube key. (Key kisi file mein mat likhna, repo public hai.)
3. GitHub: **Actions > Daily feed update > Run workflow**. Ho jaye to `public/feed.json` mein videos aa jayengi. Logs mein `OK` / `SKIP` lines dikhengi.
4. Cloudflare: **Workers & Pages > Create > Import a repository** se is repo ko connect karo. Build command khali, deploy command default rakho.
5. Cloudflare project ki **Settings > Variables and secrets** mein secret `YOUTUBE_API_KEY` add karo (wahi key), phir redeploy.
6. Naya `*.workers.dev` link khol kar test karo, phir Blogger/Hostinger iframe ka `src` badlo.

## Rozana kaam
- Channels badalne ho to `channels.json` edit karo (har category mein `@handle` likho).
- Feed har roz 06:00 IST par khud update hogi.
