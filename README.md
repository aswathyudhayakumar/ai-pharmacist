# AI Pharmacist

An agentic pharmacist layer built into a Tata 1mg-style pharmacy app. It reads prescriptions, checks a patient's medication history for problems, explains its reasoning with sources the user can open, and routes anything that legally needs a licensed pharmacist to a human queue.

Built as a take-home exercise.

**Live app:** `[https://ai-pharmacist-beta.vercel.app/]`
Use the patient selector under the top bar to switch between the two demo patients. Running it locally needs your own Anthropic API key (see [Run it locally](#run-it-locally)).

## Try it in 60 seconds

1. Switch to **Lakshmi** (older patient, on several medicines). Search **"diabetes medicine"**. The app promotes her actual prescribed metformin and flags the homeopathic drops that are sold as if they treat diabetes.
2. Open a cold or decongestant product and ask **"Can I take this?"**. It checks her record, sees hypertension and diabetes, and warns that decongestants can raise blood pressure and blood glucose, with a source you can open.
3. Switch to **Ananya** (new user). Her record is empty. Grant consent, and her history loads from a simulated ABDM fetch. Now the agent has something to reason over.

## The problem

People use delivery apps for groceries and food, but the user adoption of pharmacy apps is comparatively less. The brief I was given was to lift new-user adoption and repeat purchases for older patients who fill regular prescriptions and have trouble getting to a pharmacy, without turning the app into another chatbot with a wall of follow-up questions.

## What it does

- Reads an uploaded prescription, drafts the order, and checks it against the patient's current medicines for interactions, duplicate therapies, and cheaper generics.
- Composes search results around the patient instead of ad rank, and redirects unsafe substitutions.
- Answers product questions using what the app knows about the patient, and shows the source behind each claim.
- Splits the prescription-upload flow on the legal axis: an all-OTC order is prepared and ready in one tap, while an order with prescription drugs is routed to a pharmacist with the reason shown.
- Tracks maintenance medicines, predicts run-out, and proposes refills the patient confirms in one tap.
- Populates a new user's record from a simulated ABDM consent flow, so the agent is useful from day one instead of starting empty.

## Design decisions


**Ambient, not a chatbot.** The intelligence sits inside search, the product page, the prescription upload, etc, which are flows that the user already natively uses. There is no separate assistant button that opens a new chat. The cost is more surfaces to build than a single chat box.

**The model explains, it cannot invent facts.** There are two data sources. A patient graph holds one person's conditions, allergies, medicines, and purchases. A drug knowledge base holds general information interactions, contraindications, drug schedules, and prices. The model reads both and bases the explanation on both. It does not produce any medical facts. A made-up interaction is a safety incident, and grounding every claim in a record is v important. The cost is that the knowledge base has to be curated. The one here is seeded and illustrative.

**Two-axis routing.** Two independent checks decide how an order is handled. One is a deterministic lookup on the drug's schedule (OTC versus Schedule H, H1, X). Another is a severity score the model supplies, banded by fixed thresholds in code. An order goes to a human if either axis trips. Indian law requires a registered pharmacist for prescription drugs no matter how safe an item looks, so that call cannot sit with a model. The cost is more code than a single classifier.

**The agent drafts, a human executes.** The actions the agent is allowed to take are fixed in code as an allowlist: explain, remind, detect an interaction, reconcile a list, identify a refill gap, draft a recommendation, recommend a generic. Approving a substitution, changing a prescription, prescribing, and dispensing are not on the list, so the agent cannot do them even if the prompt tells it to. The boundary lives in code, not in a prompt that can be talked around.

## Research that shaped the design

Three areas of research changed specific decisions.

**Pharmacy law.** India has no single finalized e-pharmacy law. Online sale falls under the existing Drugs and Cosmetics Act and Rules and the Pharmacy Act, 1948. Prescription drugs sit in schedules H, H1, and X. Selling them needs a valid prescription and dispensing by a registered pharmacist, and Schedule X adds a duplicate-prescription and record-retention rule. Non-scheduled (OTC) items have no per-order pharmacist requirement. This is why the routing engine's legal axis is a deterministic schedule lookup, and why prescription items always reach the pharmacist queue regardless of how safe they seem. This is design-level understanding, not legal advice.

**Data protection.** The Digital Personal Data Protection Act, 2023 was operationalized by the DPDP Rules 2025, notified in November 2025. They require a standalone, plain-language consent notice tied to a specific purpose, a right to withdraw consent, and erasure once the purpose is served. India's ABDM health-records system uses a consent-manager model that lines up with this. The consent screen is modeled on both: purpose-scoped, granular by data type, revocable, with an audit trail. ABDM access itself is simulated.

**Clinical content.** The interactions and cautions in the knowledge base are label-level and well established, so the demo shows real medicine rather than invented risk. Oral decongestants such as pseudoephedrine and phenylephrine carry FDA-required label warnings against use in high blood pressure, diabetes, and thyroid disease, because they raise blood pressure and blood glucose. Clarithromycin raises statin levels through CYP3A4 inhibition and increases the risk of muscle injury. NSAIDs blunt the effect of blood-pressure medicines. Calcium, iron, and proton-pump inhibitors reduce absorption of levothyroxine. Each one maps to a seeded patient so the agent surfaces it in context.

## Architecture

- Next.js (App Router), TypeScript, Tailwind. Deployed on Vercel.
- A server route runs a Claude tool-use loop with five tools: read the patient graph, look up the knowledge base, classify a drug schedule, score clinical severity, and draft a recommendation.
- A separate router module makes the routing decision in plain TypeScript. Schedule classification and the gated-action guard are deterministic code, not model calls.
- The two patients and the knowledge base are seeded JSON. In production the patient record would be a graph database, since the reasoning is about relationships between medicines, conditions, and prescriptions. The prototype models it as typed JSON for the same shape without the infrastructure.
- Medical facts come only from tool lookups. The model composes and explains.

## Known limits

- Pharmacist accounts and the live pharmacist call are mocked. The queue is a working screen; the human is simulated.
- ABDM is simulated. Granting consent triggers a mocked fetch that fills the new patient's record. There is no live ABDM sandbox.
- No auto-refill toggle. A real opt-in with a notify-and-skip window needs background jobs this synchronous prototype does not have, so I left it out rather than show a switch with nothing behind it.
- The cart prices by brand, so a generic price shown in a refill proposal does not carry into the cart total. Known, out of scope for the prototype.
- The knowledge base is small and illustrative, not a clinical reference.
- Voice input is documented as an accessibility feature for older users, not built, since it does not address discoverability and adds demo risk.

## Metrics

- **North Star:** share of new users who make a second medicine purchase within 30 days. It moves only if onboarding worked and the experience was good enough to bring them back. Reported per patient type, since an older patient's second purchase is partly refill-driven.
- **Leading indicator:** time to first purchase after the first agent interaction.
- **Guardrails:** zero autonomous gated actions, interaction-miss rate, human-handoff resolution time, consent grant and revocation rate, and accessible-task completion.

## Run it locally

```
git clone <repo-url>
cd ai-pharmacist
npm install
```

Create a `.env.local` file with your own Anthropic API key:

```
ANTHROPIC_API_KEY=your-key-here
```

Get a key at console.anthropic.com. It is billed to your account, and the file is gitignored so it never enters the repo.

```
npm run dev
```

Open `http://localhost:3000`. The deployed app uses the same setup with the key stored in Vercel's environment variables.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Anthropic API (Claude), Vercel.

---

The regulatory and clinical notes reflect research done for this exercise. They are not legal or medical advice, and the knowledge base is illustrative.
