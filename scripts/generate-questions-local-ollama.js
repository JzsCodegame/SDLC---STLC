#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const crypto = require('crypto');

const DEFAULT_STUDY_GUIDE_URL = 'https://docs.google.com/document/d/1RzyuPH6ryIVD6z5iRuyJxmUa6jGLJE_wAB5R4S4mUWA/edit?tab=t.0#heading=h.fmjzqinx4dso';
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';
const QUESTIONS_FILE = process.env.OUTPUT_FILE || 'questions.json';
const HASH_FILE = process.env.STUDY_GUIDE_HASH_FILE || '.study-guide.sha256';
const UNSTABLE_MARKER_FILE = process.env.UNSTABLE_MARKER_FILE || '.question-generation-unstable';
const QUESTION_COUNT = Number(process.env.QUESTION_COUNT || 25);
const MIN_QUESTIONS_PER_TOPIC = Number(process.env.MIN_QUESTIONS_PER_TOPIC || 25);
const MIN_SCENARIO_QUESTIONS_PER_TOPIC = Number(process.env.MIN_SCENARIO_QUESTIONS_PER_TOPIC || 12);
const MIN_CONCEPT_QUESTIONS_PER_TOPIC = MIN_QUESTIONS_PER_TOPIC - MIN_SCENARIO_QUESTIONS_PER_TOPIC;
const STUDY_GUIDE_URL = process.env.STUDY_GUIDE_URL || process.env.SOURCE_DOCUMENT_URL || DEFAULT_STUDY_GUIDE_URL;
const STUDY_GUIDE_FILE = process.env.STUDY_GUIDE_FILE || '';
const STUDY_GUIDE_TEXT = process.env.STUDY_GUIDE_TEXT || '';
const QUIZ_VARIANT_SEED = process.env.QUIZ_VARIANT_SEED || new Date().toISOString().slice(0, 13);
const MAX_STUDY_GUIDE_CHARS = Number(process.env.MAX_STUDY_GUIDE_CHARS || 60000);
let ollamaUsed = false;

const TOPIC_KEYWORDS = [
  { topic: 'ServiceNow', patterns: ['servicenow', 'service now', 'incident', 'change request', 'problem ticket', 'service catalog', 'catalog item', 'assignment group', 'sla', 'cmdb'] },
  { topic: 'GitHub', patterns: ['github', 'pull request', 'pr review', 'repository hosting', 'fork', 'github actions'] },
  { topic: 'Git', patterns: ['git ', 'git:', 'version control', 'commit', 'staging area', 'branch', 'merge', 'clone', 'checkout', 'git status', 'git add', 'git commit', 'git pull', 'git push'] },
  { topic: 'Jenkins', patterns: ['jenkins', 'build job', 'pipeline job', 'console log', 'workspace', 'build trigger', 'cron trigger', 'artifact archive'] },
  { topic: 'Docker', patterns: ['docker', 'container', 'image tag', 'dockerfile', 'port mapping', 'volume mount'] },
  { topic: 'SDLC', patterns: ['sdlc', 'software development life cycle'] },
  { topic: 'STLC', patterns: ['stlc', 'software testing life cycle'] },
  { topic: 'Testing Types', patterns: ['unit test', 'integration test', 'system test', 'acceptance test', 'testing type'] },
  { topic: 'Agile & Scrum', patterns: ['agile', 'scrum', 'sprint', 'kanban'] },
  { topic: 'Requirements', patterns: ['requirement', 'functional', 'non-functional', 'srs'] },
  { topic: 'Design', patterns: ['design', 'architecture', 'uml', 'prototype'] },
  { topic: 'Defects & Bug Tracking', patterns: ['defect', 'bug', 'severity', 'priority'] },
  { topic: 'Test Artifacts', patterns: ['test case', 'test plan', 'traceability', 'rtm'] },
  { topic: 'Java', patterns: ['java', 'class', 'object', 'inheritance', 'polymorphism', 'encapsulation'] },
  { topic: 'Maintenance', patterns: ['maintenance', 'production support', 'patch'] },
  { topic: 'Deployment & DevOps', patterns: ['deployment', 'deploy', 'release', 'rollback', 'staging', 'production environment', 'devops', 'ci/cd'] }
];

const REQUIRED_TOPICS = [
  'Java',
  'SDLC',
  'STLC',
  'Git',
  'GitHub',
  'Jenkins',
  'Docker',
  'ServiceNow',
  'Testing Types',
  'Agile & Scrum',
  'Requirements',
  'Design',
  'Deployment & DevOps',
  'Defects & Bug Tracking',
  'Test Artifacts',
  'Maintenance',
  'General Concepts'
];

const JAVA_BLOCKED_TERMS = [
  'arraylist', 'hashmap', 'linkedlist', 'collection', 'collections', ' map<', ' list<', ' set<',
  'exception', 'try', 'catch', 'finally', 'throw', 'throws',
  'jvm', 'jdk', 'jre', 'thread', 'synchronized', 'volatile',
  'stream', 'lambda', 'generic', 'annotation', 'reflection',
  'file', 'jdbc', 'database', 'selenium', 'framework'
];

const JAVA_ALLOWED_TERMS = [
  'java', 'class', 'object', 'constructor', 'method', 'field', 'this',
  'extends', 'implements', 'interface', 'abstract', 'inheritance', 'polymorphism',
  'encapsulation', 'overriding', 'overloading', 'private', 'public', 'static',
  'loop', 'for (', 'while', 'break', 'array', '[]', 'string', 'equals',
  'if', 'else', 'boolean', 'int ', 'variable', 'return', 'print', 'output'
];

const DEPLOYMENT_EXCLUDED_PATTERNS = [
  /\bgit\b/,
  /\bgithub\b/,
  /\bjenkins\b/,
  /\bdocker\b/,
  /\bdockerfile\b/,
  /\bcontainer(s)?\b/,
  /\bpull request\b/,
  /\brepositor(y|ies)\b/,
  /\bcommit(s)?\b/,
  /\bbranch(es)?\b/,
  /\bservicenow\b/,
  /\bservice now\b/,
  /\bincident\b/,
  /\bchange request\b/,
  /\bproblem ticket\b/
];

const TOPIC_CHOICE_PATTERNS = {
  SDLC: [/\bplanning\b/i, /\brequirement/i, /\bdesign\b/i, /\bimplementation\b/i, /\bcoding\b/i, /\btesting\b/i, /\bdeployment\b/i, /\bmaintenance\b/i, /\bphase\b/i, /\brelease\b/i],
  STLC: [/\brequirement analysis\b/i, /\btest planning\b/i, /\btest case\b/i, /\btest design\b/i, /\btest environment\b/i, /\btest execution\b/i, /\bdefect\b/i, /\btest closure\b/i, /\bentry criteria\b/i, /\bexit criteria\b/i, /\btest summary\b/i],
  Git: [/\bgit\b/i, /\brepository\b/i, /\bworking tree\b/i, /\bstaging area\b/i, /\bcommit\b/i, /\bbranch\b/i, /\bmerge\b/i, /\bclone\b/i, /\bcheckout\b/i, /\bremote\b/i, /\bversion control\b/i],
  GitHub: [/\bgithub\b/i, /\bpull request\b/i, /\bissue\b/i, /\breview\b/i, /\bfork\b/i, /\brepository\b/i, /\bbranch protection\b/i, /\breadme\b/i, /\baction\b/i, /\bmerge\b/i, /\blabel\b/i, /\bapproval\b/i, /\bvisibility\b/i, /\bproject files\b/i, /\bhistory\b/i],
  Jenkins: [/\bjenkins\b/i, /\bbuild\b/i, /\bjob\b/i, /\bpipeline\b/i, /\bconsole\b/i, /\bconsole log\b/i, /\bworkspace\b/i, /\btrigger\b/i, /\bartifact\b/i, /\bstage\b/i, /\bautomation\b/i, /\bcheckout\b/i, /\bsaved output\b/i, /\bpermission\b/i],
  Docker: [/\bdocker\b/i, /\bcontainer\b/i, /\bcontainers\b/i, /\bimage\b/i, /\bdockerfile\b/i, /\bport mapping\b/i, /\bvolume\b/i, /\btag\b/i, /\bregistry\b/i, /\bhost port\b/i, /\bport\b/i, /\blayer\b/i, /\bmount\b/i, /\bpath\b/i, /\bversion\b/i, /\blabel\b/i],
  ServiceNow: [/\bservicenow\b/i, /\bservice now\b/i, /\bincident\b/i, /\bchange\b/i, /\bproblem\b/i, /\bservice request\b/i, /\bservice catalog\b/i, /\bservice\b/i, /\bassignment group\b/i, /\bsla\b/i, /\bpriority\b/i, /\bstatus\b/i, /\bcmdb\b/i, /\bapproval\b/i, /\bresponse\b/i, /\bresolution\b/i, /\btarget\b/i, /\bsupport team\b/i, /\bbreach\b/i, /\brequest/i, /\bticket/i],
  'Testing Types': [/\bunit\b/i, /\bintegration\b/i, /\bsystem\b/i, /\bacceptance\b/i, /\bfunctional\b/i, /\bnon-functional\b/i, /\bsmoke\b/i, /\bsanity\b/i, /\bregression\b/i, /\bperformance\b/i, /\bsecurity\b/i, /\bexploratory\b/i, /\busability\b/i, /\btesting\b/i],
  'Agile & Scrum': [/\bagile\b/i, /\bscrum\b/i, /\bsprint\b/i, /\bproduct owner\b/i, /\bscrum master\b/i, /\bdevelopment team\b/i, /\bstakeholder\b/i, /\bbacklog\b/i, /\bincrement\b/i, /\bkanban\b/i, /\bstory point\b/i, /\bestimate\b/i, /\bretrospective\b/i, /\bdaily scrum\b/i, /\bburndown\b/i],
  Requirements: [/\bfunctional requirement\b/i, /\bnon-functional requirement\b/i, /\buser story\b/i, /\buse case\b/i, /\bacceptance criteria\b/i, /\bsrs\b/i, /\bbusiness rule\b/i, /\brequirement\b/i, /\bscope\b/i, /\buser value\b/i, /\bperformance target\b/i, /\bactor\b/i, /\binteraction\b/i],
  Design: [/\barchitecture\b/i, /\bhigh-level design\b/i, /\blow-level design\b/i, /\buml\b/i, /\bclass diagram\b/i, /\bsequence diagram\b/i, /\bsequence\b/i, /\bprototype\b/i, /\bwireframe\b/i, /\bmodule\b/i, /\bmodule design\b/i, /\bmodule logic\b/i, /\bmessage order\b/i, /\bscreen layout\b/i, /\blayers\b/i, /\bfields\b/i],
  'Deployment & DevOps': [/\bdeployment\b/i, /\bdeploy\b/i, /\brelease\b/i, /\bstaging\b/i, /\bproduction\b/i, /\brollback\b/i, /\benvironment\b/i, /\bgo-live\b/i, /\brelease readiness\b/i],
  'Defects & Bug Tracking': [/\bdefect\b/i, /\bbug\b/i, /\bseverity\b/i, /\bpriority\b/i, /\breproduc/i, /\bexpected result\b/i, /\bactual result\b/i, /\bfixed\b/i, /\bretest\b/i, /\bclosed\b/i, /\breopen/i, /\bassigned\b/i, /\bopen\b/i, /\bimpact\b/i, /\burgency\b/i, /\bowner\b/i],
  'Test Artifacts': [/\btest plan\b/i, /\btest case\b/i, /\btest data\b/i, /\brtm\b/i, /\btraceability\b/i, /\btest summary\b/i, /\btest report\b/i, /\btest script\b/i, /\bexpected result\b/i, /\bsteps\b/i, /\bcoverage\b/i, /\bexecution\b/i, /\btesting scope\b/i],
  Maintenance: [/\bcorrective maintenance\b/i, /\badaptive maintenance\b/i, /\bperfective maintenance\b/i, /\bpreventive maintenance\b/i, /\bpatch\b/i, /\bproduction support\b/i, /\bhotfix\b/i, /\bsupport release\b/i, /\bfuture risk\b/i, /\breleased defect\b/i, /\benvironment change\b/i, /\blive system\b/i]
};

const TOPIC_GUIDANCE = {
  Java: 'Beginner Java OOP plus core basics only: classes, objects, constructors, methods, fields, this, encapsulation, inheritance, polymorphism, abstraction, interfaces, loops, arrays, strings, conditionals, variables, boolean logic, and simple output. Do not use blocked advanced Java topics.',
  SDLC: 'Software Development Life Cycle phases, order, purpose, artifacts, and beginner scenarios.',
  STLC: 'Software Testing Life Cycle phases, test planning, test cases, execution, closure, entry and exit criteria.',
  Git: 'Beginner Git version control: repositories, working tree, staging area, commits, branches, merge, clone, status, add, commit, pull, push, checkout, log, and resolving simple collaboration scenarios.',
  GitHub: 'Beginner GitHub collaboration: repositories, pull requests, issues, reviews, forks, branches, README files, and basic GitHub Actions awareness.',
  Jenkins: 'Beginner Jenkins CI: jobs, builds, console logs, workspaces, triggers, scheduled builds, artifacts, pipeline basics, and troubleshooting a failed build.',
  Docker: 'Beginner Docker: images, containers, Dockerfile, tags, ports, volumes, container lifecycle, and why containerized apps run consistently.',
  ServiceNow: 'Beginner ServiceNow ITSM: incidents, change requests, problem tickets, service catalog, assignment groups, SLA, status, priority, and basic ticket workflow.',
  'Testing Types': 'Unit, integration, system, acceptance, functional, non-functional, smoke, sanity, regression, exploratory, performance, security testing.',
  'Agile & Scrum': 'Agile values, Scrum roles, Sprint events, Product Backlog, Sprint Backlog, Increment, Kanban, story points.',
  Requirements: 'Functional and non-functional requirements, SRS, user stories, use cases, acceptance criteria.',
  Design: 'UML, architecture, high-level design, low-level design, prototypes, simple design patterns.',
  'Deployment & DevOps': 'Deployment and release basics that are not specific to Git, GitHub, Jenkins, Docker, or ServiceNow: environments, staging, production, rollback, release readiness, and basic DevOps flow.',
  'Defects & Bug Tracking': 'Defect lifecycle, severity, priority, bug reports, reproduction steps, expected vs actual results.',
  'Test Artifacts': 'Test plans, test cases, RTM, traceability, test data, test summary reports.',
  Maintenance: 'Corrective, adaptive, perfective, preventive maintenance, production support, patches, change management.',
  'General Concepts': 'Beginner software engineering and QA concepts that do not fit a more specific topic.'
};

const FALLBACK_BANKS = {
  Java: [
    q('Java class and object: what is printed?', ['class Student { String name = "Mia"; }', 'Student s = new Student();', 'System.out.println(s.name);'], ['Student', 'name', 'Mia', 'null'], 2),
    q('Java constructor: what value is printed?', ['class Car {', '  String model;', '  Car(String model) { this.model = model; }', '}', 'System.out.println(new Car("Civic").model);'], ['Car', 'model', 'Civic', 'null'], 2),
    q('Java encapsulation: what does the getter return?', ['class Counter {', '  private int value = 7;', '  int getValue() { return value; }', '}', 'System.out.println(new Counter().getValue());'], ['0', '7', 'value', 'private'], 1),
    q('Java inheritance: which method is used?', ['class Animal { String sound() { return "sound"; } }', 'class Dog extends Animal { String sound() { return "bark"; } }', 'Animal pet = new Dog();', 'System.out.println(pet.sound());'], ['sound', 'bark', 'Dog', 'Animal'], 1),
    q('Java method overloading: what is printed?', ['class MathBox {', '  int add(int a, int b) { return a + b; }', '  int add(int a, int b, int c) { return a + b + c; }', '}', 'System.out.println(new MathBox().add(1, 2, 3));'], ['3', '6', '123', 'Compilation error'], 1),
    q('Java this keyword: what is printed?', ['class Ticket {', '  int id;', '  Ticket(int id) { this.id = id; }', '}', 'System.out.println(new Ticket(5).id);'], ['0', '5', 'id', 'this'], 1),
    q('Java interface polymorphism: what is printed?', ['interface Alert { String send(); }', 'class EmailAlert implements Alert { public String send() { return "sent"; } }', 'Alert alert = new EmailAlert();', 'System.out.println(alert.send());'], ['Alert', 'EmailAlert', 'sent', 'send'], 2),
    q('Java abstract class: what is printed?', ['abstract class Shape { abstract String name(); }', 'class Circle extends Shape { String name() { return "circle"; } }', 'Shape shape = new Circle();', 'System.out.println(shape.name());'], ['Shape', 'Circle', 'circle', 'abstract'], 2),
    q('Java loop: what is printed?', ['for (int i = 1; i <= 3; i++) {', '  System.out.print(i);', '}'], ['012', '123', '1234', '111'], 1),
    q('Java array length: what is printed?', ['int[] numbers = {2, 4, 6};', 'System.out.println(numbers.length);'], ['2', '3', '4', '6'], 1),
    q('Java array update: what is printed?', ['String[] names = {"Ana", "Bo"};', 'names[1] = "Cam";', 'System.out.println(names[1]);'], ['Ana', 'Bo', 'Cam', '2'], 2),
    q('Java String equality: what is printed?', ['String a = "QA";', 'String b = "QA";', 'System.out.println(a.equals(b));'], ['true', 'false', 'QA', 'Compilation error'], 0),
    q('Java if statement: which word is printed?', ['int age = 18;', 'if (age >= 18) { System.out.println("Adult"); } else { System.out.println("Minor"); }'], ['Adult', 'Minor', '18', 'No output'], 0),
    q('Java boolean logic: what is printed?', ['boolean ready = true;', 'boolean blocked = true;', 'System.out.println(ready && !blocked);'], ['true', 'false', 'ready', 'blocked'], 1),
    q('Java static field: what is printed?', ['class Visit { static int count = 0; }', 'Visit.count++;', 'Visit.count++;', 'System.out.println(Visit.count);'], ['0', '1', '2', 'Compilation error'], 2)
  ],
  SDLC: [
    basic('SDLC scenario: which phase defines scope, schedule, and resources?', ['Planning', 'Testing', 'Deployment', 'Maintenance'], 0),
    basic('SDLC scenario: which phase documents business needs?', ['Design', 'Requirement Analysis', 'Implementation', 'Deployment'], 1),
    basic('SDLC scenario: which phase creates architecture and UI plans?', ['Planning', 'Design', 'Testing', 'Maintenance'], 1)
  ],
  STLC: [
    basic('STLC scenario: which phase reviews requirements for testability?', ['Requirement Analysis', 'Test Closure', 'Deployment', 'Design'], 0),
    basic('STLC scenario: which phase defines scope, resources, schedule, and risks?', ['Test Planning', 'Implementation', 'Production Support', 'Coding'], 0),
    basic('STLC scenario: which phase runs test cases and logs defects?', ['Test Execution', 'Design', 'Planning', 'Requirement Gathering'], 0)
  ],
  Git: [
    basic('Git: which command shows changed files before a commit?', ['git status', 'git clone', 'git init', 'git remote'], 0),
    basic('Git: which command stages a file for the next commit?', ['git add', 'git push', 'git log', 'git branch'], 0),
    basic('Git: what does a branch let a team do?', ['Work on changes separately', 'Delete the repository', 'Run a server', 'Create a Docker image'], 0),
    basic('Git: which command records staged changes in local history?', ['git commit', 'git pull', 'git clone', 'git fetch'], 0),
    basic('Git: which command sends local commits to a remote repository?', ['git push', 'git status', 'git add', 'git log'], 0)
  ],
  GitHub: [
    basic('GitHub: what is a pull request mainly used for?', ['Review and discuss changes before merging', 'Start a local server', 'Create a test case', 'Install Docker'], 0),
    basic('GitHub: what does an issue usually track?', ['A bug, task, or requested change', 'Only compiled code', 'Only a password', 'Only a server port'], 0),
    basic('GitHub: what is a fork?', ['A personal copy of a repository', 'A failed build', 'A test report', 'A production release'], 0),
    basic('GitHub: what does a repository usually contain?', ['Project files and change history', 'Only production passwords', 'Only browser cookies', 'Only meeting audio'], 0)
  ],
  Jenkins: [
    basic('Jenkins: what does a build job usually do?', ['Runs automated steps such as build, test, or deploy', 'Writes user stories only', 'Stores meeting notes only', 'Replaces Git'], 0),
    basic('Jenkins: where would you look first to debug a failed build?', ['Console log', 'Product backlog', 'Class diagram', 'RTM only'], 0),
    basic('Jenkins: what does a scheduled trigger do?', ['Starts a job automatically at configured times', 'Deletes source code', 'Creates a Java class', 'Changes a bug severity'], 0),
    basic('Jenkins: what is a workspace?', ['The folder where a job checks out and builds files', 'A Java keyword', 'A ServiceNow SLA', 'A Docker port only'], 0)
  ],
  Docker: [
    basic('Docker: what is a container?', ['A runnable package of an app and its environment', 'A Git branch', 'A Jira ticket', 'A test case'], 0),
    basic('Docker: what does a Dockerfile describe?', ['Steps to build an image', 'Steps to write a user story', 'Steps to assign severity', 'Steps to create an RTM'], 0),
    basic('Docker: why is port mapping used?', ['To expose a container port on the host', 'To rename a branch', 'To close a defect', 'To write a constructor'], 0),
    basic('Docker: what is an image?', ['A reusable template used to start containers', 'A Git commit message', 'A test closure report', 'A Scrum event'], 0)
  ],
  ServiceNow: [
    basic('ServiceNow: what is an incident usually used for?', ['Restoring service after something is broken', 'Writing Java code', 'Creating a Docker image', 'Merging a branch'], 0),
    basic('ServiceNow: what does a change request control?', ['Planned changes to a service or system', 'Only local Git commits', 'Only quiz scores', 'Only CSS colors'], 0),
    basic('ServiceNow: why is an assignment group useful?', ['It routes work to the right support team', 'It runs unit tests', 'It builds a Docker image', 'It changes Java output'], 0),
    basic('ServiceNow: what does an SLA measure?', ['Expected response or resolution time', 'Number of Git branches', 'Docker image size only', 'Java class count only'], 0)
  ],
  'Testing Types': [
    basic('Testing Types: which testing checks that new changes did not break existing features?', ['Regression testing', 'Smoke testing', 'Load testing', 'Usability testing'], 0),
    basic('Testing Types: which testing quickly checks whether a build is stable?', ['Smoke testing', 'Acceptance testing', 'Security testing', 'Localization testing'], 0),
    basic('Testing Types: which testing checks modules working together?', ['Integration testing', 'Unit testing', 'Static testing', 'Alpha testing'], 0)
  ],
  'Agile & Scrum': [
    basic('Agile & Scrum: which event plans the work for the next Sprint?', ['Sprint Planning', 'Daily Scrum', 'Sprint Review', 'Retrospective'], 0),
    basic('Agile & Scrum: which role owns product priority?', ['Product Owner', 'Scrum Master', 'QA Lead', 'Release Manager'], 0),
    basic('Agile & Scrum: which artifact lists ordered product work?', ['Product Backlog', 'RTM', 'Test Plan', 'Deployment Script'], 0)
  ],
  Requirements: [
    basic('Requirements: which statement describes a functional requirement?', ['What the system must do', 'How fast the page must load', 'Which server hosts the app', 'How the sprint is scheduled'], 0),
    basic('Requirements: which statement describes a non-functional requirement?', ['The app must support 500 users at once', 'The user can reset a password', 'The admin can add products', 'The form saves an address'], 0)
  ],
  Design: [
    basic('Design: which diagram can show classes and relationships?', ['UML class diagram', 'Bug report', 'Daily Scrum note', 'Build log'], 0),
    basic('Design: which design level describes detailed module logic?', ['Low-level design', 'Sprint review', 'Smoke testing', 'Bug triage'], 0)
  ],
  'Deployment & DevOps': [
    basic('Deployment & DevOps: what is a production deployment?', ['Releasing tested software to users', 'Writing a class diagram', 'Renaming a meeting note', 'Changing a logo color'], 0),
    basic('Deployment & DevOps: why is rollback planning useful?', ['It gives a way to recover if a release has problems', 'It replaces all testing', 'It deletes the backlog', 'It removes the need for approvals'], 0),
    basic('Deployment & DevOps: what is a staging environment used for?', ['Testing a release in a production-like place', 'Writing lesson notes only', 'Choosing a font family', 'Drawing a class mascot'], 0)
  ],
  'Defects & Bug Tracking': [
    basic('Defects & Bug Tracking: what does severity describe?', ['Impact of the defect', 'Order of fixing work', 'Developer seniority', 'Sprint length'], 0),
    basic('Defects & Bug Tracking: what does priority describe?', ['Urgency of fixing the defect', 'How many testers found it', 'How old the ticket is', 'Which browser was used'], 0)
  ],
  'Test Artifacts': [
    basic('Test Artifacts: what does an RTM connect?', ['Requirements to test cases', 'Developers to branches', 'Users to roles', 'Servers to ports'], 0),
    basic('Test Artifacts: what does a test case include?', ['Steps and expected result', 'Only source code', 'Only a server name', 'Only a sprint date'], 0)
  ],
  Maintenance: [
    basic('Maintenance: which type fixes defects after release?', ['Corrective maintenance', 'Perfective maintenance', 'Adaptive maintenance', 'Prototype design'], 0),
    basic('Maintenance: which type improves existing behavior after release?', ['Perfective maintenance', 'Unit testing', 'Sprint planning', 'Requirement traceability'], 0)
  ],
  'General Concepts': [
    basic('General Concepts: what is QA focused on?', ['Improving product quality', 'Only writing code', 'Only deploying servers', 'Only assigning story points'], 0),
    basic('General Concepts: why is documentation useful?', ['It helps teams share and verify understanding', 'It replaces all testing', 'It removes all defects', 'It disables deployment'], 0)
  ]
};

function q(question, codeLines, choices, answer) {
  return { question, code: codeLines.join('\n'), choices, answer };
}

function basic(question, choices, answer) {
  return { question, choices, answer };
}

function scenario(question, choices, answer) {
  return basic(question, choices, answer);
}

function concept(question, choices, answer) {
  return basic(question, choices, answer);
}

const QUALITY_FALLBACK_BANKS = {
  Java: [
    q('Java scenario: a student creates two Car objects. What prints for car2?', ['class Car { String color = "red"; }', 'Car car1 = new Car();', 'Car car2 = new Car();', 'car1.color = "blue";', 'System.out.println(car2.color);'], ['blue', 'red', 'null', 'Compilation error'], 1),
    q('Java scenario: a constructor saves the name. What prints?', ['class Student {', '  String name;', '  Student(String name) { this.name = name; }', '}', 'System.out.println(new Student("Mia").name);'], ['Student', 'name', 'Mia', 'null'], 2),
    q('Java scenario: a loop counts from 1 to 3. What prints?', ['for (int i = 1; i <= 3; i++) {', '  System.out.print(i);', '}'], ['012', '123', '1234', '111'], 1),
    concept('Java concept: which idea hides fields behind methods?', ['Encapsulation', 'Inheritance', 'Polymorphism', 'Abstraction'], 0),
    concept('Java concept: which keyword refers to the current object?', ['this', 'extends', 'implements', 'return'], 0),
    concept('Java concept: which structure stores ordered values by index?', ['Array', 'Class', 'Constructor', 'Method'], 0)
  ],
  SDLC: [
    scenario('SDLC scenario: a team is defining scope, timeline, and resources. Which phase is this?', ['Planning phase', 'Requirement analysis phase', 'Design phase', 'Deployment phase'], 0),
    scenario('SDLC scenario: stakeholders explain what the app must do. Which phase fits best?', ['Requirement analysis phase', 'Design phase', 'Testing phase', 'Maintenance phase'], 0),
    scenario('SDLC scenario: architects map screens and modules before coding. Which phase is this?', ['Design phase', 'Implementation phase', 'Deployment phase', 'Maintenance phase'], 0),
    concept('SDLC concept: which phase writes and builds the software?', ['Implementation phase', 'Planning phase', 'Testing phase', 'Maintenance phase'], 0),
    concept('SDLC concept: which phase checks the built product against requirements?', ['Testing phase', 'Design phase', 'Planning phase', 'Deployment phase'], 0),
    concept('SDLC concept: which phase releases the tested product to users?', ['Deployment phase', 'Requirement analysis phase', 'Design phase', 'Implementation phase'], 0)
  ],
  STLC: [
    scenario('STLC scenario: QA reviews requirements for testability. Which phase is this?', ['Requirement analysis phase', 'Test planning phase', 'Test execution phase', 'Test closure phase'], 0),
    scenario('STLC scenario: QA estimates effort, schedule, risks, and resources. Which phase is this?', ['Test planning phase', 'Test case design phase', 'Defect retest phase', 'Test closure phase'], 0),
    scenario('STLC scenario: testers run cases and log defects. Which phase is this?', ['Test execution phase', 'Requirement analysis phase', 'Test environment setup phase', 'Test closure phase'], 0),
    concept('STLC concept: which item defines when testing can start?', ['Entry criteria', 'Exit criteria', 'Defect status', 'Test summary'], 0),
    concept('STLC concept: which item defines when testing can stop?', ['Exit criteria', 'Entry criteria', 'Defect priority', 'Test environment'], 0),
    concept('STLC concept: which phase summarizes results and lessons learned?', ['Test closure phase', 'Requirement analysis phase', 'Test planning phase', 'Test execution phase'], 0)
  ],
  Git: [
    scenario('Git scenario: a developer wants to see changed files before committing. Which command fits?', ['git status', 'git log', 'git branch', 'git remote'], 0),
    scenario('Git scenario: a developer wants to save staged work locally. Which command fits?', ['git commit', 'git add', 'git push', 'git clone'], 0),
    scenario('Git scenario: a teammate needs a separate line of work for a feature. Which Git concept helps?', ['Git branch', 'Git remote', 'Git tag', 'Git log'], 0),
    concept('Git concept: what is the staging area used for?', ['Preparing changes for a commit', 'Listing remote branches', 'Naming a repository', 'Viewing commit history'], 0),
    concept('Git concept: what does git clone create?', ['A local repository copy', 'A staging area snapshot', 'A commit message only', 'A branch merge only'], 0),
    concept('Git concept: what does git push update?', ['A remote repository', 'A working tree only', 'A staging area only', 'A commit author only'], 0)
  ],
  GitHub: [
    scenario('GitHub scenario: a teammate wants review before merging code. Which GitHub feature fits?', ['Pull request', 'Issue', 'Fork', 'README'], 0),
    scenario('GitHub scenario: a bug needs discussion and tracking. Which GitHub feature fits?', ['Issue', 'Pull request', 'Repository branch', 'GitHub review'], 0),
    scenario('GitHub scenario: a contributor needs their own copy before proposing changes. Which feature fits?', ['Fork', 'Issue label', 'Pull request review', 'Branch protection'], 0),
    concept('GitHub concept: what does a repository hold?', ['Project files and history', 'Pull request comments only', 'Issue labels only', 'Review approvals only'], 0),
    concept('GitHub concept: what does a pull request review provide?', ['Review feedback before merge', 'Issue status only', 'Repository name only', 'Fork ownership only'], 0),
    concept('GitHub concept: what does branch protection help enforce?', ['Repository merge rules', 'Issue title format', 'README length', 'Fork visibility'], 0)
  ],
  Jenkins: [
    scenario('Jenkins scenario: a scheduled job starts every morning. Which Jenkins feature does this describe?', ['Build trigger', 'Console log', 'Workspace', 'Artifact archive'], 0),
    scenario('Jenkins scenario: a build failed and QA needs the error output. Where should they look?', ['Console log', 'Workspace cleanup', 'Artifact archive', 'Pipeline stage name'], 0),
    scenario('Jenkins scenario: a job checks out files and runs build steps in a folder. What is that folder?', ['Workspace', 'Console log', 'Build trigger', 'Artifact archive'], 0),
    concept('Jenkins concept: what is a build job?', ['A configured automation task', 'A console log message', 'A workspace folder only', 'An artifact file only'], 0),
    concept('Jenkins concept: what is a pipeline stage?', ['A named step group in a pipeline', 'A build number only', 'A console log line only', 'A workspace permission only'], 0),
    concept('Jenkins concept: what is an artifact?', ['A saved build output', 'A trigger schedule', 'A console error', 'A workspace checkout'], 0)
  ],
  Docker: [
    scenario('Docker scenario: a learner wants to run an app with the same environment on any machine. What should they start?', ['Container', 'Image tag', 'Dockerfile step', 'Volume mount'], 0),
    scenario('Docker scenario: a web app runs inside a container and must be reachable from the host. What is needed?', ['Port mapping', 'Image tag', 'Dockerfile comment', 'Container name'], 0),
    scenario('Docker scenario: app data should survive container replacement. Which Docker feature helps?', ['Volume', 'Container log', 'Image layer', 'Docker tag'], 0),
    concept('Docker concept: what is an image?', ['A reusable template for containers', 'A running container process', 'A host port rule', 'A volume mount path'], 0),
    concept('Docker concept: what does a Dockerfile define?', ['Image build steps', 'Container runtime logs', 'Volume data contents', 'Port traffic history'], 0),
    concept('Docker concept: what does an image tag identify?', ['Image version or label', 'Container memory only', 'Volume owner only', 'Port protocol only'], 0)
  ],
  ServiceNow: [
    scenario('ServiceNow scenario: a user cannot access email and needs service restored. Which record fits?', ['Incident', 'Problem ticket', 'Change request', 'Service catalog request'], 0),
    scenario('ServiceNow scenario: a planned firewall update needs approval before release. Which record fits?', ['Change request', 'Incident', 'Problem ticket', 'Service catalog request'], 0),
    scenario('ServiceNow scenario: repeated outages need root cause investigation. Which record fits?', ['Problem ticket', 'Incident', 'Change task', 'Service request'], 0),
    concept('ServiceNow concept: what does an SLA measure?', ['Response or resolution target', 'Incident category only', 'Change approval group', 'Problem root cause note'], 0),
    concept('ServiceNow concept: what does an assignment group do?', ['Routes work to a support team', 'Sets incident priority only', 'Approves every change request', 'Closes every problem ticket'], 0),
    concept('ServiceNow concept: what is the service catalog used for?', ['Requesting approved services', 'Investigating problem tickets', 'Measuring SLA breach time', 'Assigning incident priority'], 0)
  ],
  'Testing Types': [
    scenario('Testing Types scenario: QA checks whether a new login change broke checkout. Which testing type fits?', ['Regression testing', 'Smoke testing', 'Usability testing', 'Security testing'], 0),
    scenario('Testing Types scenario: QA quickly checks if a new build is stable enough for more testing. Which type fits?', ['Smoke testing', 'Regression testing', 'Performance testing', 'Acceptance testing'], 0),
    scenario('Testing Types scenario: QA checks how modules work together after integration. Which type fits?', ['Integration testing', 'Unit testing', 'Exploratory testing', 'Security testing'], 0),
    concept('Testing Types concept: which type checks a small code unit?', ['Unit testing', 'System testing', 'Acceptance testing', 'Regression testing'], 0),
    concept('Testing Types concept: which type checks business approval?', ['Acceptance testing', 'Unit testing', 'Smoke testing', 'Performance testing'], 0),
    concept('Testing Types concept: which type checks speed and load behavior?', ['Performance testing', 'Smoke testing', 'Sanity testing', 'Exploratory testing'], 0)
  ],
  'Agile & Scrum': [
    scenario('Agile & Scrum scenario: the team chooses work for the next Sprint. Which event is this?', ['Sprint Planning', 'Daily Scrum', 'Sprint Review', 'Sprint Retrospective'], 0),
    scenario('Agile & Scrum scenario: the team inspects the increment with stakeholders. Which event is this?', ['Sprint Review', 'Sprint Planning', 'Daily Scrum', 'Backlog refinement'], 0),
    scenario('Agile & Scrum scenario: the team discusses how to improve its process. Which event is this?', ['Sprint Retrospective', 'Daily Scrum', 'Sprint Review', 'Sprint Planning'], 0),
    concept('Agile & Scrum concept: who owns product priority?', ['Product Owner', 'Scrum Master', 'Development Team', 'Stakeholder'], 0),
    concept('Agile & Scrum concept: what lists ordered product work?', ['Product Backlog', 'Sprint Backlog', 'Increment', 'Burndown Chart'], 0),
    concept('Agile & Scrum concept: what is delivered at the end of a Sprint?', ['Increment', 'Product Backlog', 'Daily Scrum', 'Story point estimate'], 0)
  ],
  Requirements: [
    scenario('Requirements scenario: a user says they must reset a password by email. What type is this?', ['Functional requirement', 'Non-functional requirement', 'Business rule', 'Acceptance criteria'], 0),
    scenario('Requirements scenario: the app must support 500 users at once. What type is this?', ['Non-functional requirement', 'Functional requirement', 'Use case', 'User story'], 0),
    scenario('Requirements scenario: QA needs pass/fail details for a story. What should they review?', ['Acceptance criteria', 'SRS glossary', 'Business rule', 'Use case actor'], 0),
    concept('Requirements concept: what is a user story?', ['Requirement written from user value', 'Non-functional performance target', 'SRS table of contents', 'Business rule exception only'], 0),
    concept('Requirements concept: what does an SRS document contain?', ['Requirement details and scope', 'Use case actors only', 'Acceptance criteria only', 'Business rule names only'], 0),
    concept('Requirements concept: what is a use case focused on?', ['User-system interaction', 'Requirement priority only', 'SRS version history', 'Acceptance criteria wording'], 0)
  ],
  Design: [
    scenario('Design scenario: architects show system layers and major components. Which artifact fits?', ['Architecture diagram', 'UML class diagram', 'Prototype screen', 'Sequence diagram'], 0),
    scenario('Design scenario: a team shows classes and relationships for an object model. Which diagram fits?', ['UML class diagram', 'Sequence diagram', 'Wireframe prototype', 'High-level design'], 0),
    scenario('Design scenario: a designer wants early feedback on screen layout. Which artifact fits?', ['Prototype', 'Architecture diagram', 'Low-level design', 'Module design'], 0),
    concept('Design concept: what does high-level design describe?', ['Architecture and major modules', 'Module logic details', 'Prototype colors only', 'Sequence message timing only'], 0),
    concept('Design concept: what does low-level design describe?', ['Detailed module logic', 'Architecture overview', 'Wireframe layout only', 'Class diagram title only'], 0),
    concept('Design concept: what does a sequence diagram show?', ['Object message order', 'Architecture layers', 'Prototype navigation', 'Module database fields'], 0)
  ],
  'Deployment & DevOps': [
    scenario('Deployment & DevOps scenario: a tested release is moved to users. Which activity is this?', ['Production deployment', 'Staging validation', 'Rollback planning', 'Release readiness review'], 0),
    scenario('Deployment & DevOps scenario: a release has a severe issue and must return to the previous version. What is needed?', ['Rollback plan', 'Staging environment', 'Deployment window', 'Release checklist'], 0),
    scenario('Deployment & DevOps scenario: a team tests a release in a production-like place. Which environment is this?', ['Staging environment', 'Production environment', 'Rollback environment', 'Release window'], 0),
    concept('Deployment & DevOps concept: what is release readiness?', ['Confirmation that deployment conditions are met', 'Production users receiving a release', 'Rollback after a failed release', 'Staging environment naming'], 0),
    concept('Deployment & DevOps concept: what is a deployment window?', ['Approved time for release activity', 'Production support ticket status', 'Rollback checklist owner', 'Staging test account'], 0),
    concept('Deployment & DevOps concept: what is rollback?', ['Returning to a previous stable release', 'Approving a deployment window', 'Validating a staging release', 'Starting a production release'], 0)
  ],
  'Defects & Bug Tracking': [
    scenario('Defects & Bug Tracking scenario: a bug blocks checkout for all users. Which field describes impact?', ['Severity', 'Priority', 'Defect status', 'Reopen reason'], 0),
    scenario('Defects & Bug Tracking scenario: a fixed bug is sent back to QA. Which status fits?', ['Retest', 'Closed', 'Reopened', 'Open'], 0),
    scenario('Defects & Bug Tracking scenario: QA sees the same issue after a fix. Which status fits?', ['Reopened', 'Closed', 'Fixed', 'Assigned'], 0),
    concept('Defects & Bug Tracking concept: what does priority describe?', ['Urgency of fixing the bug', 'Impact of the defect', 'Actual result text', 'Reproduction step count'], 0),
    concept('Defects & Bug Tracking concept: what does severity describe?', ['Impact of the defect', 'Fix urgency', 'Bug owner name', 'Closed date'], 0),
    concept('Defects & Bug Tracking concept: what should expected result describe?', ['Expected result behavior', 'Actual result behavior', 'Defect priority urgency', 'Defect owner name'], 0)
  ],
  'Test Artifacts': [
    scenario('Test Artifacts scenario: QA needs steps, data, and expected result for one check. Which artifact fits?', ['Test case', 'Test plan', 'RTM', 'Test summary report'], 0),
    scenario('Test Artifacts scenario: a lead connects requirements to test coverage. Which artifact fits?', ['RTM', 'Test data', 'Test case', 'Test summary report'], 0),
    scenario('Test Artifacts scenario: the team summarizes execution results after a cycle. Which artifact fits?', ['Test summary report', 'Test plan', 'Test data', 'RTM'], 0),
    concept('Test Artifacts concept: what does a test plan define?', ['Testing scope and approach', 'Test case expected result only', 'RTM requirement links only', 'Test data values only'], 0),
    concept('Test Artifacts concept: what does test data support?', ['Test case execution', 'Test plan approval only', 'RTM trace links only', 'Test summary totals only'], 0),
    concept('Test Artifacts concept: what does traceability show?', ['Requirement-to-test coverage', 'Test data owner only', 'Test plan title only', 'Test summary date only'], 0)
  ],
  Maintenance: [
    scenario('Maintenance scenario: a production defect is fixed after release. Which type is this?', ['Corrective maintenance', 'Perfective maintenance', 'Adaptive maintenance', 'Preventive maintenance'], 0),
    scenario('Maintenance scenario: a browser policy changes and the app must adjust. Which type is this?', ['Adaptive maintenance', 'Corrective maintenance', 'Perfective maintenance', 'Preventive maintenance'], 0),
    scenario('Maintenance scenario: a feature is improved based on user feedback. Which type is this?', ['Perfective maintenance', 'Corrective maintenance', 'Adaptive maintenance', 'Preventive maintenance'], 0),
    concept('Maintenance concept: what is preventive maintenance?', ['Preventive maintenance risk reduction', 'Corrective maintenance defect fix', 'Adaptive maintenance environment change', 'Perfective maintenance improvement'], 0),
    concept('Maintenance concept: what is a patch?', ['Small support release', 'Corrective maintenance category only', 'Adaptive maintenance request only', 'Perfective maintenance review only'], 0),
    concept('Maintenance concept: what is production support?', ['Support for live system issues', 'Preventive maintenance planning only', 'Patch version naming only', 'Adaptive maintenance design only'], 0)
  ],
  'General Concepts': [
    scenario('General Concepts scenario: a team wants shared understanding before work starts. What helps most?', ['Clear documentation', 'More hidden assumptions', 'Less review', 'Delayed feedback'], 0),
    scenario('General Concepts scenario: QA and developers compare expected behavior before testing. What are they improving?', ['Shared product understanding', 'Hidden defect ownership', 'Delayed requirement review', 'Reduced communication'], 0),
    concept('General Concepts concept: what is QA focused on?', ['Improving product quality', 'Avoiding all documentation', 'Skipping validation', 'Removing feedback'], 0),
    concept('General Concepts concept: why is documentation useful?', ['It preserves shared understanding', 'It replaces all testing', 'It removes all defects', 'It prevents all changes'], 0)
  ]
};

function requireQuestionCount() {
  if (!Number.isInteger(QUESTION_COUNT) || QUESTION_COUNT < 1 || QUESTION_COUNT > 60) {
    throw new Error('QUESTION_COUNT must be an integer from 1 to 60.');
  }
  if (!Number.isInteger(MIN_QUESTIONS_PER_TOPIC) || MIN_QUESTIONS_PER_TOPIC < 1 || MIN_QUESTIONS_PER_TOPIC > 60) {
    throw new Error('MIN_QUESTIONS_PER_TOPIC must be an integer from 1 to 60.');
  }
  if (!Number.isInteger(MIN_SCENARIO_QUESTIONS_PER_TOPIC) || MIN_SCENARIO_QUESTIONS_PER_TOPIC < 0 || MIN_SCENARIO_QUESTIONS_PER_TOPIC > MIN_QUESTIONS_PER_TOPIC) {
    throw new Error('MIN_SCENARIO_QUESTIONS_PER_TOPIC must be an integer from 0 to MIN_QUESTIONS_PER_TOPIC.');
  }
}

function googleDocExportUrl(url) {
  const match = url.match(/docs\.google\.com\/document\/d\/([^/?#]+)/);
  if (!match) return url;
  return `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
}

function stripHtml(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function cleanStudyGuide(text) {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_STUDY_GUIDE_CHARS);
}

async function loadStudyGuide() {
  if (STUDY_GUIDE_TEXT.trim()) return cleanStudyGuide(STUDY_GUIDE_TEXT);
  if (STUDY_GUIDE_FILE.trim()) return cleanStudyGuide(await fs.readFile(STUDY_GUIDE_FILE, 'utf8'));

  const url = googleDocExportUrl(STUDY_GUIDE_URL);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'mini-quiz-academy-local-ollama-generator/1.0' }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch study guide. HTTP ${response.status}. Check sharing/access for ${url}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  const cleaned = cleanStudyGuide(contentType.includes('html') ? stripHtml(raw) : raw);
  if (!cleaned || cleaned.length < 200) {
    throw new Error('Study guide content is too short or could not be read.');
  }
  return cleaned;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function readTextIfExists(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function readQuestionsIfExists(file) {
  const text = await readTextIfExists(file);
  if (!text.trim()) return [];
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error(`${file} must contain a JSON array.`);
  return parsed;
}

function normalizeQuestion(question) {
  return {
    question: String(question.question || '').trim(),
    code: question.code ? String(question.code).trim() : undefined,
    choices: (question.choices || []).map((choice) => String(choice || '').trim()),
    answer: Number(question.answer),
    aiGenerated: question.aiGenerated === true || undefined
  };
}

function questionIdentity(question) {
  return `${question.question || ''} ${question.code || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

function questionSearchText(question) {
  return [
    question.question,
    question.code,
    ...(Array.isArray(question.choices) ? question.choices : [])
  ].join(' ').toLowerCase();
}

function javaQuestionText(question) {
  return questionSearchText(question);
}

function isBeginnerJavaQuestion(question) {
  const text = javaQuestionText(question);
  return JAVA_ALLOWED_TERMS.some((term) => text.includes(term))
    && !JAVA_BLOCKED_TERMS.some((term) => text.includes(term));
}

function isDeploymentReleaseQuestion(question) {
  const text = questionSearchText(question);
  return !DEPLOYMENT_EXCLUDED_PATTERNS.some((pattern) => pattern.test(text));
}

function isScenarioQuestion(question) {
  const text = String(question.question || '').toLowerCase();
  return /\bscenario\b/.test(text)
    || /\ba team\b/.test(text)
    || /\ba tester\b/.test(text)
    || /\ba developer\b/.test(text)
    || /\ba user\b/.test(text)
    || /\ba learner\b/.test(text)
    || /\bstakeholders?\b/.test(text)
    || /\bduring\b/.test(text);
}

function questionStyle(question) {
  return isScenarioQuestion(question) ? 'scenario' : 'concept';
}

function choiceMatchesTopic(topic, choice) {
  const patterns = TOPIC_CHOICE_PATTERNS[topic];
  if (!patterns) return true;
  return patterns.some((pattern) => pattern.test(String(choice || '')));
}

function choicesStayInTopic(topic, question) {
  if (topic === 'Java' || topic === 'General Concepts') return true;
  return question.choices.every((choice) => choiceMatchesTopic(topic, choice));
}

function detectTopic(questionText = '') {
  const text = questionText.toLowerCase();
  const explicitTopic = REQUIRED_TOPICS.find((topic) =>
    text === topic.toLowerCase()
      || text.startsWith(`${topic.toLowerCase()}:`)
      || text.startsWith(`${topic.toLowerCase()} `)
  );
  if (explicitTopic) return explicitTopic;

  const found = TOPIC_KEYWORDS.find(({ patterns }) => patterns.some((pattern) => text.includes(pattern)));
  return found ? found.topic : 'General Concepts';
}

function sanitizeQuestions(rawQuestions) {
  const sanitized = [];
  const seen = new Set();

  for (const raw of rawQuestions) {
    const question = normalizeQuestion(raw);
    if (!question.question) continue;
    if (!Array.isArray(question.choices) || question.choices.length !== 4 || question.choices.some((choice) => !choice)) continue;
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) continue;
    const topic = detectTopic(question.question);
    if (topic === 'Java' && !isBeginnerJavaQuestion(question)) continue;
    if (topic === 'Deployment & DevOps' && !isDeploymentReleaseQuestion(question)) continue;
    if (!choicesStayInTopic(topic, question)) continue;

    const key = questionIdentity(question);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    if (!question.code) delete question.code;
    if (!question.aiGenerated) delete question.aiGenerated;
    sanitized.push(question);
  }

  return sanitized;
}

function groupByTopic(questions) {
  const grouped = new Map();
  for (const question of questions) {
    const topic = detectTopic(question.question);
    if (!grouped.has(topic)) grouped.set(topic, []);
    grouped.get(topic).push(question);
  }
  return grouped;
}

function countQuestionStyles(questions) {
  return questions.reduce((counts, question) => {
    counts[questionStyle(question)] += 1;
    return counts;
  }, { scenario: 0, concept: 0 });
}

function countStyleDeficit(questions) {
  const styles = countQuestionStyles(questions);
  return {
    scenario: Math.max(0, MIN_SCENARIO_QUESTIONS_PER_TOPIC - styles.scenario),
    concept: Math.max(0, MIN_CONCEPT_QUESTIONS_PER_TOPIC - styles.concept)
  };
}

function totalStyleDeficit(questions) {
  const deficit = countStyleDeficit(questions);
  return deficit.scenario + deficit.concept;
}

function selectBalancedTopicQuestions(topicQuestions) {
  const scenarios = topicQuestions
    .filter((question) => questionStyle(question) === 'scenario')
    .slice(0, MIN_SCENARIO_QUESTIONS_PER_TOPIC);
  const concepts = topicQuestions
    .filter((question) => questionStyle(question) === 'concept')
    .slice(0, MIN_CONCEPT_QUESTIONS_PER_TOPIC);
  return [...scenarios, ...concepts];
}

function balanceQuestionsByTopic(questions) {
  const grouped = groupByTopic(questions);
  const balanced = [];

  for (const topic of REQUIRED_TOPICS) {
    const topicQuestions = grouped.get(topic) || [];
    balanced.push(...selectBalancedTopicQuestions(topicQuestions));
  }

  return balanced;
}

function validateQuestionBank(questions) {
  const sanitized = balanceQuestionsByTopic(sanitizeQuestions(questions));
  const grouped = groupByTopic(sanitized);
  const errors = [];

  if (sanitized.length !== sanitizeQuestions(questions).length) {
    errors.push(`Balanced question count ${sanitized.length} differs from sanitized count ${sanitizeQuestions(questions).length}.`);
  }

  for (const topic of REQUIRED_TOPICS) {
    const topicQuestions = grouped.get(topic) || [];
    const count = topicQuestions.length;
    const styles = countQuestionStyles(topicQuestions);
    if (count !== MIN_QUESTIONS_PER_TOPIC) {
      errors.push(`${topic} has ${count}/${MIN_QUESTIONS_PER_TOPIC} balanced questions.`);
    }
    if (styles.scenario < MIN_SCENARIO_QUESTIONS_PER_TOPIC) {
      errors.push(`${topic} has ${styles.scenario}/${MIN_SCENARIO_QUESTIONS_PER_TOPIC} scenario questions.`);
    }
    if (styles.concept < MIN_CONCEPT_QUESTIONS_PER_TOPIC) {
      errors.push(`${topic} has ${styles.concept}/${MIN_CONCEPT_QUESTIONS_PER_TOPIC} concept questions.`);
    }
  }

  const javaQuestions = grouped.get('Java') || [];
  const javaBlockedHits = javaQuestions.filter((question) =>
    JAVA_BLOCKED_TERMS.some((term) => javaQuestionText(question).includes(term))
  );
  if (javaBlockedHits.length > 0) {
    errors.push(`Java blocked-term hits: ${javaBlockedHits.length}.`);
  }

  return { ok: errors.length === 0, errors, sanitized, grouped };
}

function parseOllamaJson(text) {
  const trimmed = String(text || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
    throw new Error(`Ollama response did not contain JSON. Response: ${trimmed.slice(0, 300)}`);
  }
}

async function callOllama(prompt) {
  ollamaUsed = true;
  console.log(`Calling local Ollama endpoint ${OLLAMA_API_URL} with model ${OLLAMA_MODEL}.`);
  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      format: 'json',
      stream: false,
      options: {
        temperature: Number(process.env.OLLAMA_TEMPERATURE || 0.2),
        top_p: Number(process.env.OLLAMA_TOP_P || 0.9)
      }
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Ollama request failed. HTTP ${response.status}: ${text}`);
  }

  const payload = JSON.parse(text);
  if (!payload.response) {
    throw new Error(`Ollama response did not include a response field: ${text.slice(0, 300)}`);
  }
  return payload.response;
}

function buildPrompt(topic, count, existingQuestions, studyGuide) {
  const existingList = existingQuestions
    .slice(0, 35)
    .map((question) => `- ${question.question}`)
    .join('\n');
  const styles = countQuestionStyles(existingQuestions);
  const scenarioNeeded = Math.max(0, MIN_SCENARIO_QUESTIONS_PER_TOPIC - styles.scenario);
  const conceptNeeded = Math.max(0, MIN_CONCEPT_QUESTIONS_PER_TOPIC - styles.concept);
  const styleInstruction = scenarioNeeded > 0
    ? `Prioritize scenario-based questions first; this topic still needs ${scenarioNeeded} scenario question(s).`
    : `Prioritize concept/definition questions; this topic still needs ${conceptNeeded} concept question(s).`;

  return [
    'You generate quiz questions for beginner software testing students.',
    `Create exactly ${count} multiple-choice questions for topic: ${topic}.`,
    `Quiz variant seed: ${QUIZ_VARIANT_SEED}.`,
    `Topic guidance: ${TOPIC_GUIDANCE[topic] || TOPIC_GUIDANCE['General Concepts']}`,
    `Balance rule: each topic must end with exactly ${MIN_QUESTIONS_PER_TOPIC} questions: ${MIN_SCENARIO_QUESTIONS_PER_TOPIC} scenario-based questions and ${MIN_CONCEPT_QUESTIONS_PER_TOPIC} concept/definition questions.`,
    styleInstruction,
    '',
    'Hard rules:',
    '- Return valid JSON only.',
    '- Return either an array of question objects or an object with a "questions" array.',
    '- Each question needs: question string, choices array of exactly 4 strings, answer zero-based index 0-3.',
    '- Exactly one answer is correct.',
    '- No all-of-the-above or none-of-the-above.',
    '- Avoid duplicates and do not reuse existing questions.',
    `- Prefix scenario questions with "${topic} scenario:" and concept/definition questions with "${topic} concept:".`,
    '- Prefer practical scenario, output-prediction, and choose-the-correct-answer questions.',
    '- Every answer choice must stay inside the same topic domain. Use plausible in-topic distractors, not random off-topic answers.',
    '- Example: a ServiceNow question must use four ServiceNow choices such as Incident, Problem, Change request, Service catalog request, SLA, assignment group, priority, or status.',
    '- For Java, include short beginner code snippets when useful.',
    `- Java blocked terms: ${JAVA_BLOCKED_TERMS.join(', ')}.`,
    '- Never include blocked Java terms in Java questions.',
    '',
    'Existing questions to avoid:',
    existingList || '(none)',
    '',
    'Study guide excerpt:',
    studyGuide,
    '',
    'JSON shape:',
    '{"questions":[{"question":"...","code":"optional code snippet","choices":["A","B","C","D"],"answer":0}]}'
  ].join('\n');
}

async function generateQuestionsForTopic(topic, count, existingQuestions, studyGuide) {
  const prompt = buildPrompt(topic, count, existingQuestions, studyGuide);
  const text = await callOllama(prompt);
  const parsed = parseOllamaJson(text);
  const rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions;
  if (!Array.isArray(rawQuestions)) {
    throw new Error(`Ollama JSON for ${topic} did not contain a questions array.`);
  }

  const tagged = rawQuestions.map((question) => ({ ...question, aiGenerated: true }));
  const sanitized = sanitizeQuestions(tagged).filter((question) => detectTopic(question.question) === topic);
  if (sanitized.length < Math.min(count, rawQuestions.length)) {
    console.warn(`Ollama returned ${rawQuestions.length} raw ${topic} item(s), ${sanitized.length} passed validation.`);
  }
  return sanitized.slice(0, count);
}

function fallbackQuestions(topic, count, existingQuestions) {
  const fullBank = QUALITY_FALLBACK_BANKS[topic] || FALLBACK_BANKS[topic] || QUALITY_FALLBACK_BANKS['General Concepts'];
  const output = [];
  const seen = new Set(existingQuestions.map(questionIdentity));
  let index = 0;

  while (output.length < count) {
    const styles = countQuestionStyles([...existingQuestions, ...output]);
    const preferredStyle = styles.scenario < MIN_SCENARIO_QUESTIONS_PER_TOPIC ? 'scenario' : 'concept';
    const preferredBank = fullBank.filter((question) => questionStyle(question) === preferredStyle);
    const bank = preferredBank.length ? preferredBank : fullBank;
    const base = bank[index % bank.length];
    const cycle = Math.floor(index / bank.length);
    const fallback = {
      ...base,
      question: cycle === 0 ? base.question : `${base.question} (fallback review ${cycle + 1})`
    };
    const key = questionIdentity(fallback);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(fallback);
    }
    index += 1;
  }

  return output;
}

function mergeQuestions(existingQuestions, additions) {
  return balanceQuestionsByTopic(sanitizeQuestions([...existingQuestions, ...additions]));
}

async function writeQuestionsSafely(file, questions) {
  const tempFile = `${file}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(questions, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, file);
}

async function main() {
  requireQuestionCount();
  await fs.rm(UNSTABLE_MARKER_FILE, { force: true });

  console.log(`Loading study guide from ${STUDY_GUIDE_FILE || STUDY_GUIDE_URL || 'STUDY_GUIDE_TEXT'}.`);
  const studyGuide = await loadStudyGuide();
  const currentHash = sha256(studyGuide);
  const previousHash = (await readTextIfExists(HASH_FILE)).trim();
  console.log(`Loaded study guide content (${studyGuide.length} characters, sha256=${currentHash}).`);

  let questions = sanitizeQuestions(await readQuestionsIfExists(QUESTIONS_FILE));
  let validation = validateQuestionBank(questions);
  const unstableReasons = [];

  if (previousHash === currentHash && validation.ok) {
    console.log('Study guide hash unchanged and current questions.json is valid; no change.');
    console.log('ollama_used=false');
    console.log('anthropic_used=false');
    return;
  }

  if (previousHash !== currentHash) {
    try {
      const fresh = await generateQuestionsForTopic('General Concepts', QUESTION_COUNT, questions, studyGuide);
      questions = mergeQuestions(questions, fresh);
      console.log(`Merged ${fresh.length} local Ollama study-guide question(s).`);
    } catch (error) {
      unstableReasons.push(`Ollama study-guide generation failed: ${error.message}`);
      console.warn(unstableReasons[unstableReasons.length - 1]);
    }
  }

  validation = validateQuestionBank(questions);
  questions = validation.sanitized;

  for (const topic of REQUIRED_TOPICS) {
    const grouped = groupByTopic(questions);
    const existing = grouped.get(topic) || [];
    const needed = totalStyleDeficit(existing);
    if (needed <= 0) continue;

    let additions = [];
    try {
      additions = await generateQuestionsForTopic(topic, needed, existing, studyGuide);
      console.log(`Added ${additions.length} local Ollama question(s) for ${topic}.`);
    } catch (error) {
      unstableReasons.push(`Ollama topic generation failed for ${topic}: ${error.message}`);
      console.warn(unstableReasons[unstableReasons.length - 1]);
    }

    const acceptedTopicQuestions = sanitizeQuestions([...existing, ...additions])
      .filter((question) => detectTopic(question.question) === topic);
    const balancedTopicQuestions = selectBalancedTopicQuestions(acceptedTopicQuestions);
    const fallbackNeeded = totalStyleDeficit(balancedTopicQuestions);
    if (fallbackNeeded > 0) {
      additions = additions.concat(fallbackQuestions(topic, fallbackNeeded, [...existing, ...additions]));
      unstableReasons.push(`Used ${fallbackNeeded} deterministic fallback question(s) for ${topic}.`);
      console.warn(unstableReasons[unstableReasons.length - 1]);
    }

    questions = mergeQuestions(questions, additions);
  }

  validation = validateQuestionBank(questions);
  if (!validation.ok) {
    throw new Error(`Final validation failed; previous questions.json left untouched. ${validation.errors.join(' | ')}`);
  }

  await writeQuestionsSafely(QUESTIONS_FILE, validation.sanitized);
  await fs.writeFile(HASH_FILE, `${currentHash}\n`, 'utf8');

  if (unstableReasons.length) {
    await fs.writeFile(UNSTABLE_MARKER_FILE, `${unstableReasons.join('\n')}\n`, 'utf8');
    console.warn(`Completed with fallback/unstable notes: ${unstableReasons.join(' | ')}`);
  }

  const finalCounts = Object.fromEntries(REQUIRED_TOPICS.map((topic) => [
    topic,
    {
      total: groupByTopic(validation.sanitized).get(topic)?.length || 0,
      ...countQuestionStyles(groupByTopic(validation.sanitized).get(topic) || [])
    }
  ]));
  console.log(`Wrote valid ${QUESTIONS_FILE} using local Ollama/fallback safety net.`);
  console.log(`Question counts: ${JSON.stringify(finalCounts)}`);
  console.log(`ollama_used=${ollamaUsed}`);
  console.log('anthropic_used=false');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
