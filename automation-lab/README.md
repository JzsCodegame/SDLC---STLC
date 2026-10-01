# Mini Quiz Academy automation lab

The academy opens a focused Class 2 guide and a real Help Desk practice application. Students can create, search, filter, and update records. Playwright and Cypress test the same six workflows. The cloud workspace configuration is authored and passes Compose parsing, shell parsing, and Terraform schema validation; it has not been deployed or proven for 50 concurrent students.

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
| Academy / GitHub Pages | Lessons, curriculum, quizzes, and lab entry | Existing public site; lab entry verified locally |
| React and Node practice app | Actual UI and ticket API under test | Build, API, Playwright, and Cypress checks pass locally |
| Coder | Student sign-in, browser editor, terminal, private app links | Configuration work; cloud runtime unverified |
| DigitalOcean | Student workspace compute and persistent storage | Registered credential missing; account/quota unknown |
| Cloudflare | Domain and DNS routing | Historical domain `kfk-786.com`; current zone access unverified |
| Firebase | Existing academy question/score integration | Preserved; no new authentication, rules, or score writes |

The initial workspace design uses invited Coder accounts. Existing Firebase score storage does not automatically provide Coder sign-in. Student workspaces must not receive DigitalOcean or Firebase administrative credentials. No Render migration or shutdown has occurred.

## Release boundaries

1. The local practice app is usable and its exercises are executed tests.
2. Cloud workspaces are not connected: `lab-config.json` deliberately has a null workspace URL. Do not publish a working-cloud claim or enable this link before authenticated acceptance checks pass.
3. Docker is unavailable locally, so the container and VM boot sequence need runtime verification.
4. Resolve DigitalOcean access, inventory current resources and quotas, and verify the chosen subdomain before provisioning.
5. Review the concrete provisioning cost, then deploy a one-student pilot. Verify invitation/sign-in, repository, PowerShell/Git/npm, browser view, persistence, and denial of access from another student account.
6. Rehearse with 10 and then 50 active student sessions running browser tests. Record startup time, memory/CPU, failures, responsiveness, stop/resume, and isolation. Fifty is a minimum capacity target, not an achieved result or an enrollment cap.

## Cost context, not an account quote

DigitalOcean's public list price checked October 1, 2026 is $0.03571/hour ($24/month cap) for a Basic 2-vCPU/4-GiB Droplet, or $0.07143/hour ($48/month cap) for 4-vCPU/8-GiB. Fifty of those student VMs for two hours would be approximately $3.57 or $7.14 in workspace compute alone. Leaving fifty VMs allocated continuously would reach roughly $1,200 or $2,400 per month in compute alone. These figures exclude the control server, persistent volumes, images/backups, extra transfer, taxes, warm-up/cleanup time, and any paid Coder features. They do not establish account eligibility, quota, or sufficient performance.

Source: [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets). Measure the real browser workload before choosing the final size. Stopping a process or powering off a VM is not the same as deleting a billable Droplet. Preserve student storage and verify the platform's actual stop lifecycle before expecting compute savings.

## Documentation

- `practice-app/README.md`: student commands, exercises, API, test data, and rollback.
- `infra/`: workspace and control-server configuration; read its verification limits before use.
- `evidence/`: local preview, browser, and cloud-access evidence in the KFK working copy. These contain local paths and are not student site assets.

Process flow: academy -> automation guide -> authenticated student workspace -> edit a test -> run Playwright or Cypress -> inspect browser and assertions -> retain work -> stop workspace.

Current verified local flow: academy -> automation guide -> local practice app -> create/search/update tickets -> run framework suites -> inspect actual results.
