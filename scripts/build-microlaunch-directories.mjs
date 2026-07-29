import fs from 'node:fs';
import path from 'node:path';

const MICRO_LAUNCH_DIRECTORIES = [
  { name: "Nick Launches", url: "https://nicklaunches.com/", category: "Micro Launch & Backlink" },
  { name: "MicroLaunch", url: "https://microlaunch.net/submit", category: "Micro Launch & Backlink" },
  { name: "Uneed Best Tools", url: "https://www.uneed.best/submit", category: "Tool Launch" },
  { name: "DevHunt", url: "https://devhunt.org", category: "Developer Tools" },
  { name: "LaunchingNext", url: "https://www.launchingnext.com/submit/", category: "Startup Launch" },
  { name: "LaunchDock", url: "https://launchdock.cloud/", category: "Micro Launch" },
  { name: "AeroLaunch", url: "https://aerolaunch.app/", category: "App Launch" },
  { name: "Dang.ai", url: "https://dang.ai/submit", category: "AI Tool Directory" },
  { name: "AI Tool Directory", url: "https://tooldirectory.ai/submit-tool", category: "AI Tools" },
  { name: "SaaS AI Tools", url: "https://saasaitools.com/submit", category: "SaaS AI" },
  { name: "FutureTools", url: "https://www.futuretools.io/submit-a-tool", category: "AI Directory" },
  { name: "Futurepedia", url: "https://www.futurepedia.io/submit-tool", category: "AI Directory" },
  { name: "AI Top Tools", url: "https://aitoptools.com/submit-a-tool/", category: "AI Directory" },
  { name: "Theres An AI For That", url: "https://theresanaiforthat.com/submit/", category: "AI Directory" },
  { name: "All Things AI", url: "https://allthingsai.com/submit", category: "AI Directory" },
  { name: "TopAI.tools", url: "https://topai.tools/submit", category: "AI Directory" },
  { name: "Tiny Launch", url: "https://www.tinylaun.ch", category: "Micro Launch" },
  { name: "AIAI.Tools", url: "https://aiai.tools/submit-ai-tool", category: "AI Tools" },
  { name: "Cloud Findr", url: "https://cloudfindr.co", category: "Cloud & SaaS" },
  { name: "No Code Founders", url: "https://nocodefounders.com", category: "Indie Tools" },
  { name: "Hive Index", url: "https://thehiveindex.com/submit", category: "Communities" },
  { name: "findstack", url: "https://findstack.com", category: "Tech Stack" },
  { name: "Five Taco", url: "https://fivetaco.com", category: "Software Tools" },
  { name: "AI ToolBoard", url: "https://aitoolboard.com/submit-ai-tool", category: "AI Tools" },
  { name: "Lib Hunt", url: "https://libhunt.com", category: "Developer Tools" },
  { name: "Open Startup List", url: "https://openstartuplist.com", category: "Open Source" },
  { name: "Startup Buffer", url: "https://startupbuffer.com/site/submit", category: "Startups" },
  { name: "Insidr.ai", url: "https://www.insidr.ai/submit-tools", category: "AI Directory" },
  { name: "Openfuture", url: "https://openfuture.ai/submit-tool", category: "AI Tools" },
  { name: "MarsX", url: "https://www.marsx.dev/ai-startups", category: "AI Startups" },
  { name: "The AI Navigator", url: "https://www.theainavigator.com/submit-an-ai-tool", category: "AI Tools" },
  { name: "StartupBase", url: "https://startupbase.io", category: "Startup Launch" },
  { name: "Startup Inspire", url: "https://startupinspire.com", category: "Startups" },
  { name: "AI Directories", url: "https://www.aidirectori.es", category: "AI Tools" },
  { name: "All GPTs", url: "https://allgpts.co", category: "AI & GPTs" },
  { name: "AI Hub", url: "https://aihub.org/contribute/", category: "AI Resources" },
  { name: "Public APIs", url: "https://publicapis.dev", category: "API Directory" },
  { name: "Startup Fame", url: "https://startupfa.me", category: "Startups" },
  { name: "10 Words", url: "https://10words.io", category: "Micro Launch" },
  { name: "Ai Valley", url: "https://aivalley.ai/submit-tool", category: "AI Tools" },
  { name: "PoweredbyAI", url: "https://poweredbyai.app/submit-tool", category: "AI Tools" },
  { name: "AI Depot", url: "https://aidepot.co", category: "AI Directory" },
  { name: "Productivity Directory", url: "https://productivity.directory", category: "Productivity" },
  { name: "AI of The Day", url: "https://aioftheday.com/submit-a-tool", category: "AI Tools" },
  { name: "Canopy Directory", url: "https://www.canopydirectory.com/suggest-tool", category: "Tools" },
  { name: "Mr. Free Tools", url: "https://mrfreetools.com", category: "Free Tools" },
  { name: "Lachief.io", url: "https://lachief.io", category: "Product Launch" },
  { name: "AI Tool Guru", url: "https://aitoolguru.com/submit-ai-tool", category: "AI Tools" },
  { name: "AI Tools", url: "https://aitools.lol", category: "AI Directory" },
  { name: "Tool Scout", url: "https://toolscout.ai/submit", category: "AI Tools" },
  { name: "ToolsForHumans.ai", url: "https://toolsforhumans.ai", category: "AI Tools" },
  { name: "Gpts Hunter", url: "https://gptshunter.com", category: "AI Tools" }
];

console.log(`Setting up ${MICRO_LAUNCH_DIRECTORIES.length} Micro Launch & Tool Backlink platforms...`);

const jsonPath = path.resolve('data/directory-submission-info.json');
const existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

existingData.directories = MICRO_LAUNCH_DIRECTORIES;

fs.writeFileSync(jsonPath, JSON.stringify(existingData, null, 2), 'utf8');
console.log(`Successfully saved ${MICRO_LAUNCH_DIRECTORIES.length} micro launch & tool directories to ${jsonPath}!`);
