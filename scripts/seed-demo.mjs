#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY before seeding.');
  process.exit(1);
}

const accounts = JSON.parse(await readFile(new URL('../demo-accounts.json', import.meta.url), 'utf8'));
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function call(base, path, method = 'GET', body, prefer) {
  const response = await fetch(`${base}/${path}`, {
    method,
    headers: {
      ...headers,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const code = result?.code || result?.error_code || 'SUPABASE_ERROR';
    const detail = result?.message || result?.msg || 'Request failed';
    throw new Error(`${method} ${path.split('?')[0]} failed (${response.status}, ${code}): ${detail}`);
  }
  return result;
}

const rest = (path, method = 'GET', body, prefer) => call(`${supabaseUrl}/rest/v1`, path, method, body, prefer);
const auth = (path, method = 'GET', body) => call(`${supabaseUrl}/auth/v1`, path, method, body);

const requiredTables = [
  'profiles', 'creator_profiles', 'portfolio_items', 'briefs', 'applications',
  'invitations', 'matches', 'engagements', 'deliverables', 'revisions',
  'reviews', 'notifications', 'saved_projects', 'verification_signals',
];
for (const table of requiredTables) {
  try {
    await rest(`${table}?select=id&limit=0`);
  } catch (error) {
    console.error(`Demo seed stopped before writing data. Apply supabase/migrations/202610100001_kampus_vc.sql in Supabase SQL Editor first.`);
    console.error(error.message);
    process.exit(1);
  }
}

const usersResult = await auth('admin/users?page=1&per_page=1000');
const users = usersResult?.users || [];
const usersByEmail = new Map(users.filter(user => user.email).map(user => [user.email.toLowerCase(), user]));
const seeded = [];

for (const account of accounts) {
  const metadata = {
    full_name: account.name,
    role: account.role,
    company_name: account.company_name || null,
    industry: account.industry || null,
    specialization: account.specialization || null,
  };
  const appMetadata = { kampus_demo_seed: true };
  const email = account.email.toLowerCase();
  let user = usersByEmail.get(email);
  if (user && user.app_metadata?.kampus_demo_seed !== true) {
    throw new Error(`Refusing to change ${email}: an account already exists but is not marked as a Kampus.VC demo account.`);
  }
  if (user) {
    const result = await auth(`admin/users/${user.id}`, 'PUT', {
      password: account.password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: appMetadata,
    });
    user = result?.user || result;
  } else {
    const result = await auth('admin/users', 'POST', {
      email,
      password: account.password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: appMetadata,
    });
    user = result?.user || result;
    usersByEmail.set(email, user);
  }
  if (!user?.id) throw new Error(`Supabase Auth did not return an id for ${email}.`);
  seeded.push({ ...account, id: user.id });
}

for (const account of seeded) {
  const profile = {
    id: account.id,
    auth_user_id: account.id,
    full_name: account.name,
    email: account.email,
    role: account.role,
    company_name: account.company_name || null,
    industry: account.industry || null,
    bio: account.bio || `${account.name} is an independent AI creator developing thoughtful, production-ready creative work.`,
    location: account.role === 'creator' ? 'India · Available remotely' : 'India',
    is_public: true,
    is_demo: true,
  };
  await rest('profiles?on_conflict=id', 'POST', profile, 'resolution=merge-duplicates,return=minimal');
}

const creatorDetails = [
  {
    skills: ['AI Video Generation', 'Storytelling', 'Cinematography', 'Prompt Engineering', 'Video Editing'],
    tools: ['Runway', 'Sora', 'Midjourney'], models: ['Runway Gen-3', 'Sora', 'Midjourney v7'],
    content: ['Video', 'Motion Graphics'], ratios: ['16:9', '9:16', '1:1'], years: 5, rate: 8500,
    workflow: 'Concept → storyboard → generation → edit → sound design',
  },
  {
    skills: ['Animation', 'Motion Design', 'Storytelling', 'Character Design'],
    tools: ['Runway', 'Pika', 'Midjourney'], models: ['Runway Gen-3', 'Pika 2.2', 'Midjourney v7'],
    content: ['Animation', 'Video'], ratios: ['16:9', '9:16', '1:1'], years: 4, rate: 7200,
    workflow: 'Character exploration → motion tests → compositing → final export',
  },
  {
    skills: ['Generative Art', 'Art Direction', 'Prompt Engineering', 'Visual Design'],
    tools: ['Midjourney', 'Stable Diffusion', 'Adobe Firefly'], models: ['Midjourney v7', 'SDXL', 'Firefly Image 3'],
    content: ['Image', '3D'], ratios: ['1:1', '4:5', '16:9'], years: 6, rate: 9000,
    workflow: 'Research → moodboard → visual system → generation → retouch',
  },
  {
    skills: ['Product Advertising', 'AI Video', 'Storytelling', 'Art Direction', 'Editing'],
    tools: ['Runway', 'Sora', 'Adobe Firefly', 'Midjourney'], models: ['Runway Gen-3', 'Sora', 'Firefly Image 3'],
    content: ['Video', 'Image'], ratios: ['9:16', '16:9', '1:1'], years: 5, rate: 9800,
    workflow: 'Product study → campaign concept → image and motion tests → edit',
  },
  {
    skills: ['Motion Design', '3D Design', 'Animation', 'Video Editing'],
    tools: ['Runway', 'Pika', 'Stable Diffusion'], models: ['Runway Gen-3', 'Pika 2.2', 'SDXL'],
    content: ['Motion Graphics', 'Video', '3D'], ratios: ['16:9', '9:16'], years: 5, rate: 8000,
    workflow: 'Design frames → build motion system → animate → composite → deliver',
  },
  {
    skills: ['Fashion Visuals', 'Generative Art', 'Product Photography', 'AI Video', 'Art Direction'],
    tools: ['Midjourney', 'Adobe Firefly', 'Sora', 'Runway'], models: ['Midjourney v7', 'Firefly Image 3', 'Sora'],
    content: ['Image', 'Video'], ratios: ['4:5', '9:16', '1:1'], years: 4, rate: 9200,
    workflow: 'Creative direction → styling → generation → color grade → campaign set',
  },
  {
    skills: ['3D Design', 'Product Visualization', 'Motion Graphics', 'AI Art', 'Art Direction'],
    tools: ['Stable Diffusion', 'Midjourney', 'Runway'], models: ['SDXL', 'Midjourney v7', 'Runway Gen-3'],
    content: ['3D', 'Image', 'Video'], ratios: ['16:9', '1:1', '4:5'], years: 5, rate: 10500,
    workflow: 'Product blockout → material and lighting → image generation → motion',
  },
];

const portfolioConcepts = [
  [
    ['Neon Velocity', 'Video', '9:16', 'MP4', 'A fast, cinematic sneaker reveal using wet-street reflections and directional light.'],
    ['After the Last Light', 'Video', '16:9', 'MOV', 'A premium fragrance film concept built around dusk tones and a slow reveal.'],
    ['City in Motion', 'Motion Graphics', '1:1', 'MP4', 'A city-inspired motion study for a fictional streetwear launch.'],
  ],
  [
    ['Small Worlds, Big Feelings', 'Animation', '9:16', 'MP4', 'An expressive animated character study with a playful visual rhythm.'],
    ['The Helpful Cloud', 'Animation', '1:1', 'GIF', 'A character-led micro-story designed for a fictional family technology brand.'],
    ['Orbit Friends', 'Video', '16:9', 'MOV', 'A short animated campaign concept about unlikely creative collaborators.'],
  ],
  [
    ['Objects from Tomorrow', 'Image', '1:1', 'PNG', 'Tactile product stills grounded in sculptural forms, material and light.'],
    ['Chromatic Pantry', 'Image', '4:5', 'JPG', 'A vivid food-advertising study exploring color, texture and composition.'],
    ['New Nature', '3D', '16:9', 'PNG', 'A speculative generative-art collection for a fictional home technology brand.'],
  ],
  [
    ['Form in Motion', 'Video', '9:16', 'MP4', 'A vertical product-ad concept with close details and a clear feature reveal.'],
    ['Future Form', 'Image', '1:1', 'JPG', 'A fictional product launch campaign pairing crisp art direction with bold color.'],
    ['Made to Move', 'Video', '16:9', 'MOV', 'A short product film study built around physical movement and soft studio light.'],
  ],
  [
    ['Signal Bloom', 'Motion Graphics', '16:9', 'MP4', 'A music visualizer using layered shapes and an evolving motion system.'],
    ['Future Frequency', 'Video', '9:16', 'MP4', 'A short-form visual identity concept for an independent music release.'],
    ['Motion Objects', '3D', '16:9', 'MOV', 'A 3D product visualization test focused on surface, shadow and movement.'],
  ],
  [
    ['Soft Armor', 'Image', '4:5', 'JPG', 'An editorial fashion concept mixing natural textures and sculptural styling.'],
    ['New Season, New Light', 'Video', '9:16', 'MP4', 'A fashion launch campaign test designed for vertical social placements.'],
    ['Studio in Bloom', 'Image', '1:1', 'PNG', 'A beauty-product still-life concept with soft color and precise material detail.'],
  ],
  [
    ['Sculpted Tomorrow', '3D', '16:9', 'PNG', 'A 3D product-visualization concept with clear form and reflective materials.'],
    ['Future Sole', 'Image', '1:1', 'JPG', 'A sneaker visualization study combining dimensional form and graphic lighting.'],
    ['Objects After Dark', 'Video', '4:5', 'MP4', 'A social-first product motion concept set in a futuristic studio.'],
  ],
];

const palettes = [
  ['#1c274b', '#7f5ce3', '#ffb26e'], ['#223b4e', '#66a9b1', '#f3be94'],
  ['#40264c', '#c070a4', '#f5cb7d'], ['#233a50', '#6487d8', '#f0c4aa'],
  ['#214039', '#73aa91', '#e2c176'], ['#4b294a', '#ce7294', '#efb7a1'],
  ['#273548', '#6d83a9', '#e5ad7d'],
];
function demoThumbnail(title, index) {
  const [start, middle, end] = palettes[index % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 620"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${start}"/><stop offset=".56" stop-color="${middle}"/><stop offset="1" stop-color="${end}"/></linearGradient><radialGradient id="r"><stop stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="900" height="620" fill="url(#g)"/><circle cx="660" cy="190" r="300" fill="url(#r)"/><path d="M-40 500C180 350 250 760 520 480S760 340 980 190v480H-40z" fill="#13172b" fill-opacity=".26"/><path d="M80 70h740M80 88h320" stroke="#fff" stroke-opacity=".26" stroke-width="2"/><circle cx="728" cy="422" r="94" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><text x="80" y="545" fill="#fff" font-family="Arial,sans-serif" font-size="23" letter-spacing="4">DEMO ART DIRECTION</text><text x="80" y="580" fill="#fff" fill-opacity=".76" font-family="Arial,sans-serif" font-size="13">${index + 1} · KAMPUS.VC CONCEPT</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const creatorAccounts = seeded.filter(account => account.role === 'creator');
const creatorIds = new Map(creatorAccounts.map(account => [account.name, account.id]));
for (let creatorIndex = 0; creatorIndex < creatorAccounts.length; creatorIndex++) {
  const account = creatorAccounts[creatorIndex];
  const details = creatorDetails[creatorIndex];
  const profile = {
    user_id: account.id,
    headline: `${account.specialization} · Independent AI creator`,
    bio: `${account.name} develops creator-led work in ${account.specialization.toLowerCase()}, from early art direction through final delivery.`,
    specializations: [account.specialization],
    skills: details.skills,
    ai_tools: details.tools,
    ai_models: details.models,
    content_types: details.content,
    supported_formats: ['MP4', 'MOV', 'JPG', 'PNG'],
    aspect_ratios: details.ratios,
    workflow: details.workflow,
    availability_status: 'available',
    experience_years: details.years,
    hourly_rate: details.rate,
    commercial_use_supported: true,
    commercial_use_details: 'Demo profile. Confirm exact channels, term, territory and exclusivity in each agreement.',
    rating: Number((4.7 + (creatorIndex % 4) * 0.07).toFixed(2)),
    completed_projects: 8 + creatorIndex * 3,
  };
  await rest('creator_profiles?on_conflict=user_id', 'POST', profile, 'resolution=merge-duplicates,return=minimal');

  for (let itemIndex = 0; itemIndex < portfolioConcepts[creatorIndex].length; itemIndex++) {
    const [title, contentType, aspectRatio, format, description] = portfolioConcepts[creatorIndex][itemIndex];
    const imageIndex = creatorIndex * 3 + itemIndex;
    const item = {
      creator_id: account.id,
      title,
      description,
      thumbnail_url: demoThumbnail(title, imageIndex),
      media_type: contentType === 'Animation' ? 'animation' : contentType === '3D' ? '3d' : contentType === 'Video' || contentType === 'Motion Graphics' ? 'video' : 'image',
      content_type: contentType,
      tools: details.tools.slice(0, 3),
      models: details.models.slice(0, 2),
      skills: details.skills.slice(0, 3),
      specialization: account.specialization,
      workflow: details.workflow,
      format,
      aspect_ratio: aspectRatio,
      commercial_use: true,
      commercial_use_details: 'Demo concept only; agree exact commercial terms before commissioned use.',
      project_context: 'Illustrative demo concept for a fictional brand; not commissioned client work.',
      client_name: 'Fictional demo brand',
      is_published: true,
    };
    const search = new URLSearchParams({ select: 'id', creator_id: `eq.${account.id}`, title: `eq.${title}`, limit: '1' });
    const existing = await rest(`portfolio_items?${search}`);
    if (!existing?.length) await rest('portfolio_items', 'POST', item, 'return=minimal');
  }
}

const businessAccounts = seeded.filter(account => account.role === 'brand');
const businessIds = new Map(businessAccounts.map(account => [account.company_name, account.id]));
const now = Date.now();
const deadline = days => new Date(now + days * 86400000).toISOString().slice(0, 10);
const briefSeed = [
  {
    company: 'NovaWear', title: 'Futuristic Sneaker Launch',
    description: 'Create a 30-second cinematic product video for a new performance sneaker, with a strong first-frame hook for paid social.',
    objective: 'Introduce the product silhouette and make its movement and material feel distinctive.',
    target_audience: 'Style-conscious runners and sneaker fans aged 18–35.',
    content_type: 'Product Advertising', visual_style: 'Futuristic, cinematic, high-contrast',
    required_tools: ['Runway', 'Sora'], required_skills: ['Storytelling', 'Video Generation', 'Cinematography'],
    formats: ['MP4'], aspect_ratio: '9:16', number_of_deliverables: 1,
    budget_min: 50000, budget_max: 100000, currency: 'INR', deadline: deadline(35),
    commercial_use: true, licensing_requirements: 'Paid advertising and social media; confirm territory, duration and exclusivity before agreement.',
  },
  {
    company: 'NovaWear', title: 'Luxury Fashion AI Campaign',
    description: 'Develop a cohesive set of AI fashion visuals for a premium seasonal collection across square and portrait placements.',
    objective: 'Establish a memorable visual direction that can extend across the collection launch.',
    target_audience: 'Premium fashion shoppers and editorial audiences.',
    content_type: 'Fashion & Lifestyle', visual_style: 'Editorial, tactile, refined',
    required_tools: ['Midjourney'], required_skills: ['Generative Art', 'Art Direction'],
    formats: ['JPG', 'PNG'], aspect_ratio: '4:5', number_of_deliverables: 6,
    budget_min: 40000, budget_max: 80000, currency: 'INR', deadline: deadline(42),
    commercial_use: true, licensing_requirements: 'Social and digital campaign use; confirm duration and territory.',
  },
  {
    company: 'NovaWear', title: 'Summer Product Social Campaign',
    description: 'Create three short-form social video concepts for a summer product drop, each with a distinct opening and clear product moment.',
    objective: 'Build awareness and provide a reusable family of vertical social assets.',
    target_audience: 'Mobile-first fashion and lifestyle audiences.',
    content_type: 'AI Video', visual_style: 'Bright, energetic, contemporary',
    required_tools: ['Runway', 'Pika'], required_skills: ['AI Video', 'Motion Design'],
    formats: ['MP4'], aspect_ratio: '9:16', number_of_deliverables: 3,
    budget_min: 30000, budget_max: 60000, currency: 'INR', deadline: deadline(28),
    commercial_use: true, licensing_requirements: 'Organic and paid social use; agree term and territory.',
  },
  {
    company: 'PixelForge Agency', title: 'AI Automotive Commercial',
    description: 'Produce a cinematic AI-assisted automotive commercial with widescreen and vertical cutdowns for a fictional electric vehicle launch.',
    objective: 'Communicate confident design and a quiet, forward-looking driving experience.',
    target_audience: 'Urban professionals considering electric mobility.',
    content_type: 'AI Filmmaking', visual_style: 'Cinematic, precise, futuristic',
    required_tools: ['Runway', 'Sora'], required_skills: ['Cinematography', 'Video Editing'],
    formats: ['MP4', 'MOV'], aspect_ratio: '16:9', number_of_deliverables: 2,
    budget_min: 80000, budget_max: 150000, currency: 'INR', deadline: deadline(49),
    commercial_use: true, licensing_requirements: 'Paid advertising and social media; confirm territory, term and cutdown rights.',
  },
  {
    company: 'PixelForge Agency', title: 'AI Beverage Advertisement',
    description: 'Create a product-visualization-led beverage ad with tactile condensation, bold lighting and a vertical social edit.',
    objective: 'Make the product feel fresh and immediately recognizable in a mobile feed.',
    target_audience: 'Young adults interested in premium non-alcoholic drinks.',
    content_type: 'Product Advertising', visual_style: 'Saturated, crisp, sensory',
    required_tools: ['Adobe Firefly', 'Runway'], required_skills: ['Generative Art', 'AI Video'],
    formats: ['MP4', 'JPG'], aspect_ratio: '9:16', number_of_deliverables: 2,
    budget_min: 40000, budget_max: 90000, currency: 'INR', deadline: deadline(31),
    commercial_use: true, licensing_requirements: 'Digital campaign use; confirm channels, duration and territory.',
  },
  {
    company: 'PixelForge Agency', title: 'Future Tech Brand Film',
    description: 'Develop a 60-second brand-film concept for a fictional future-tech product, with a clear visual arc and cinematic finish.',
    objective: 'Explain the product promise through a human-scale story instead of feature lists.',
    target_audience: 'Technology leaders, designers and early adopters.',
    content_type: 'AI Filmmaking', visual_style: 'Human, cinematic, quietly futuristic',
    required_tools: ['Runway', 'Sora'], required_skills: ['AI Filmmaking', 'Storytelling', 'Cinematography'],
    formats: ['MP4', 'MOV'], aspect_ratio: '16:9', number_of_deliverables: 1,
    budget_min: 100000, budget_max: 200000, currency: 'INR', deadline: deadline(56),
    commercial_use: true, licensing_requirements: 'Brand and paid-media use; agree channels, term, territory and source-file needs.',
  },
];

const briefsByTitle = new Map();
for (const brief of briefSeed) {
  const brandId = businessIds.get(brief.company);
  const search = new URLSearchParams({ select: 'id', brand_id: `eq.${brandId}`, title: `eq.${brief.title}`, limit: '1' });
  const existing = await rest(`briefs?${search}`);
  if (existing?.length) {
    briefsByTitle.set(brief.title, existing[0].id);
    continue;
  }
  const result = await rest('briefs', 'POST', {
    ...brief,
    brand_id: brandId,
    company_name: brief.company,
    required_tools: brief.required_tools,
    required_skills: brief.required_skills,
    status: 'published',
  }, 'return=representation');
  briefsByTitle.set(brief.title, result?.[0]?.id);
}

const creatorByName = new Map(creatorAccounts.map(account => [account.name, account]));
const applicationSeed = [
  ['Arjun Mehta', 'Futuristic Sneaker Launch', 'The product-film brief fits my cinematic workflow. I would build a tight storyboard around material detail, motion and a clear final reveal.', 78000, '3 weeks', 'submitted'],
  ['Maya Sharma', 'AI Automotive Commercial', 'I can help develop a short, characterful motion direction and coordinate a clean set of cinematic cutdowns.', 112000, '4 weeks', 'under_review'],
  ['Rohan Kapoor', 'Luxury Fashion AI Campaign', 'I would start with a visual system for lighting, texture and framing, then develop a consistent set of campaign stills.', 65000, '2 weeks', 'shortlisted'],
  ['Ananya Rao', 'Futuristic Sneaker Launch', 'I can combine product art direction and AI video tests into a concise, social-first campaign film.', 92000, '3 weeks', 'accepted'],
  ['Vikram Singh', 'Future Tech Brand Film', 'My motion design workflow can support the film’s visual system, transitions and final 16:9 delivery.', 145000, '5 weeks', 'submitted'],
  ['Isha Patel', 'Luxury Fashion AI Campaign', 'I would build an editorial image direction with considered styling and adaptable portrait and square crops.', 72000, '3 weeks', 'rejected'],
  ['Kabir Verma', 'AI Automotive Commercial', 'I can develop a dimensional product-visualization approach and support motion tests for the cinematic cut.', 128000, '4 weeks', 'submitted'],
];
const applicationRows = applicationSeed.map(([creatorName, briefTitle, proposal, proposedPrice, estimatedTimeline, status]) => ({
  brief_id: briefsByTitle.get(briefTitle),
  creator_id: creatorByName.get(creatorName)?.id,
  proposal,
  proposed_price: proposedPrice,
  estimated_timeline: estimatedTimeline,
  status,
})).filter(row => row.brief_id && row.creator_id);
if (applicationRows.length) {
  await rest('applications?on_conflict=brief_id,creator_id', 'POST', applicationRows, 'resolution=merge-duplicates,return=minimal');
}

const matchSeed = [
  ['Futuristic Sneaker Launch', 'Arjun Mehta', 96, 98, 96, 95, 100, 90, 'Strong match for cinematic AI video: Arjun lists Runway and Sora, storytelling and cinematography, and supports the requested 9:16 commercial format.'],
  ['Futuristic Sneaker Launch', 'Ananya Rao', 92, 94, 95, 92, 100, 78, 'Strong product-advertising fit with AI video, art direction and Runway/Sora experience across vertical and widescreen formats.'],
  ['Futuristic Sneaker Launch', 'Maya Sharma', 86, 91, 85, 89, 100, 70, 'Relevant motion and storytelling skills with Runway and a portfolio that supports vertical campaign work.'],
  ['Futuristic Sneaker Launch', 'Vikram Singh', 78, 82, 80, 81, 100, 60, 'Good motion-design fit with vertical video capability; the brief may need additional product-film direction.'],
  ['Luxury Fashion AI Campaign', 'Isha Patel', 97, 99, 96, 97, 100, 90, 'Excellent fashion-editorial fit with generative art direction, Midjourney and the requested portrait and square ratios.'],
  ['Luxury Fashion AI Campaign', 'Rohan Kapoor', 94, 96, 95, 96, 92, 83, 'Strong visual-system and art-direction alignment, with Midjourney plus image formats suited to a fashion campaign.'],
  ['Luxury Fashion AI Campaign', 'Maya Sharma', 87, 85, 80, 85, 95, 82, 'A useful cross-discipline fit for motion-led fashion assets; confirm still-image scope in the brief.'],
  ['AI Automotive Commercial', 'Arjun Mehta', 94, 97, 94, 95, 100, 82, 'Strong cinematic-video fit with Runway, Sora, cinematography and the requested landscape/vertical delivery.'],
  ['AI Automotive Commercial', 'Kabir Verma', 91, 92, 93, 91, 96, 80, 'Good product-visualization and motion combination with Runway and formats suited to the planned cutdowns.'],
  ['AI Automotive Commercial', 'Vikram Singh', 85, 88, 87, 83, 98, 73, 'Relevant motion graphics and editing strengths; confirm live-action-style cinematography scope before selection.'],
];
const matchRows = matchSeed.map(([briefTitle, creatorName, match_score, skills_score, portfolio_score, tools_score, format_score, other_score, reason]) => ({
  brief_id: briefsByTitle.get(briefTitle),
  creator_id: creatorByName.get(creatorName)?.id,
  match_score, skills_score, portfolio_score, tools_score, format_score, other_score,
  match_explanation: { reason, is_demo_example: true, score_basis: 'Profile, portfolio, tools, formats and availability; not a verified hiring recommendation.' },
})).filter(row => row.brief_id && row.creator_id);
if (matchRows.length) {
  await rest('matches?on_conflict=brief_id,creator_id', 'POST', matchRows, 'resolution=merge-duplicates,return=minimal');
}

console.log(`Demo seed complete: ${creatorAccounts.length} creators, ${businessAccounts.length} businesses, 21 concept portfolios, ${briefSeed.length} briefs, ${applicationRows.length} applications, and ${matchRows.length} match examples.`);
console.log('The portfolio covers are clearly marked illustrative demo art direction, not commissioned creator work.');
