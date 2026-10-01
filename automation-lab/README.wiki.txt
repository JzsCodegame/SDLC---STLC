# Mini Quiz Academy automation lab

The academy opens a focused Class 2 guide and a real Help Desk practice application. Students can create, search, filter, and update records. Playwright and Cypress test the same six workflows. A dedicated cloud pilot is deployed at https://lab.kfk-786.com with instructor sign-in, a browser IDE, PowerShell, a practice app, and a live browser. The initial cloud run passed 3 API, 6 Playwright, and 6 Cypress checks. Fifty concurrent students remain a capacity target, not a verified result.

## Local preview

From `automation-lab/practice-app`, run `npm ci` and `npm run build`. Then, from `automation-lab`, run:

```powershell
node start-preview.mjs
```

Open `http://127.0.0.1:53217/index.html`, choose **Automation testing**, then **Open local practice app**. The academy and practice app use ports 53217 and 4173. This command binds only to this computer. Stop the two preview servers with Ctrl+C. It does not start a cloud editor or a terminal in the browser.

The existing academy's lesson, curriculum, quiz, whiteboard, diagram, and Firebase files remain unchanged. The homepage gains one navigation link and wrapping for the longer navigation row. New files are `automation.html`, `automation.css`, `automation.js`, and `lab-config.json`.

## Component responsibilities

| Component | Role | Current evidence |
| --- | --- | --- |
| Academy / GitHub Pages | Lessons, curriculum, quizzes, and lab entry | Existing public site; lab entry links to the authenticated cloud pilot |
| React and Node practice app | Actual UI and ticket API under test | Build and test checks pass locally and on the cloud pilot |
| Coder | Student sign-in, browser editor, terminal, private app links | Instructor login and initial cloud workspace verified |
| DigitalOcean | Student workspace compute and persistent storage | Dedicated controller and one workspace; account limit 10 Droplets |
| Cloudflare | Domain and DNS routing | Only `lab.kfk-786.com` delegated to DigitalOcean; HTTPS verified |
| Firebase | Existing academy question/score integration | Preserved; no new authentication, rules, or score writes |

The initial workspace design uses invited Coder accounts. Existing Firebase score storage does not automatically provide Coder sign-in. Student workspaces must not receive DigitalOcean or Firebase administrative credentials. No Render migration or shutdown has occurred.

## Release boundaries

1. The instructor pilot is available through the Academy automation guide. Accounts are issued by the instructor; public self-signup is disabled.
2. A separate authenticated member was denied the instructor workspace and IDE, preview, and live-browser apps. The temporary test account was suspended afterward.
3. Stopping removed the pilot VM and retained its 25 GiB volume. Restarting restored the saved file, local Git branch, and exact Git commit; their hashes matched.
4. Coder OSS rejects its Enterprise-only port-sharing ceiling. The pilot proxy blocks sharing mutations; owner-only app configuration and cross-account denials were tested. This is not a claim that paid Coder controls are enabled.
5. The approved pilot is approximately $50.50/month base if both VMs remain allocated. Stopping the student workspace deletes its VM; the controller and retained volume continue billing.
6. Before class-wide use, arrange student accounts, raise the account quota, approve the larger operating budget, and rehearse 10 then at least 50 simultaneous sessions. Measure startup time, responsiveness, errors, isolation, and real browser-test load. No 50-student claim is made.

## Cost context, not an account quote

DigitalOcean's public list price checked October 1, 2026 is $0.03571/hour ($24/month cap) for a Basic 2-vCPU/4-GiB Droplet, or $0.07143/hour ($48/month cap) for 4-vCPU/8-GiB. Fifty of those student VMs for two hours would be approximately $3.57 or $7.14 in workspace compute alone. Leaving fifty VMs allocated continuously would reach roughly $1,200 or $2,400 per month in compute alone. These figures exclude the control server, persistent volumes, images/backups, extra transfer, taxes, warm-up/cleanup time, and any paid Coder features. They do not establish account eligibility, quota, or sufficient performance.

Source: [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets). Measure the real browser workload before choosing the final size. Stopping a process or powering off a VM is not the same as deleting a billable Droplet. Preserve student storage and verify the platform's actual stop lifecycle before expecting compute savings.

## Documentation

- `practice-app/README.md`: student commands, exercises, API, test data, and rollback.
- `infra/`: workspace and control-server configuration; read its verification limits before use.
- `evidence/`: local preview, browser, and cloud-access evidence in the KFK working copy. These contain local paths and are not student site assets.

Process flow: academy -> automation guide -> authenticated student workspace -> edit a test -> run Playwright or Cypress -> inspect browser and assertions -> retain work -> stop workspace.

Verified pilot flow: HTTPS sign-in -> private workspace -> repository and PowerShell -> Help Desk and browser checks -> owner-only app access. Stop/resume results are recorded separately.
