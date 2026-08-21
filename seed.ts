import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

// Node 20 WebSocket polyfill for Supabase
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = require('undici').WebSocket;
}

// Load environment variables from .env.local
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seedUserId = process.env.SEED_USER_ID;

if (!supabaseUrl || !supabaseServiceKey || !seedUserId) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SEED_USER_ID environment variables.');
  process.exit(1);
}

if (process.env.SEED_ENV !== 'true' || !supabaseUrl.match(/localhost|127\.0\.0\.1/)) {
  console.error('❌ Refusing to seed: target must be local and SEED_ENV=true.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Get a user to associate with the seeded data
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(seedUserId as string);

  if (userError || !userData.user) {
    console.error(`❌ Failed to fetch user ${seedUserId}:`, userError?.message || 'Not found');
    process.exit(1);
  }

  const userId = userData.user.id;
  console.log(`👤 Using user ID: ${userId}`);

  const projectId = '00000000-0000-0000-0000-000000000001';

  // Check existing project owner
  const { data: existingProject, error: existingProjectError } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .maybeSingle();

  if (existingProjectError) {
    console.error('❌ Failed to check project ownership:', existingProjectError.message);
    process.exit(1);
  }

  if (existingProject && existingProject.user_id !== userId) {
    console.error(`❌ Project ${projectId} belongs to another user. Aborting.`);
    process.exit(1);
  }

  async function assertOwned(table: string, id: string) {
    const { data: row, error: err } = await supabase
      .from(table)
      .select('project_id')
      .eq('id', id)
      .maybeSingle();
    if (err) {
      console.error(`❌ Failed to check ${table} ${id} ownership:`, err.message);
      process.exit(1);
    }
    if (row && row.project_id !== projectId) {
      console.error(`❌ ${table} ${id} belongs to another project. Aborting.`);
      process.exit(1);
    }
  }

  // 2. Create Project
  const { error: projectError } = await supabase
    .from('projects')
    .upsert({
      id: projectId,
      user_id: userId,
      name: 'Tech Review Project',
      description: 'Reviewing latest tech gadgets',
      target_platform: 'instagram',
      brand_voice: 'Informative, energetic, and professional'
    });

  if (projectError) {
    console.error('❌ Failed to create project:', projectError.message);
    process.exit(1);
  }
  console.log('✅ Inserted Project');

  // 3. Create References
  await assertOwned('references_table', '00000000-0000-0000-0000-000000000010');
  await assertOwned('references_table', '00000000-0000-0000-0000-000000000011');

  const { error: referencesError } = await supabase
    .from('references_table')
    .upsert([
      { id: '00000000-0000-0000-0000-000000000010', project_id: projectId, url: 'https://instagram.com/p/123456', caption: 'Check out this new phone!', platform: 'instagram' },
      { id: '00000000-0000-0000-0000-000000000011', project_id: projectId, url: 'https://instagram.com/p/654321', caption: 'The ultimate desk setup 💻', platform: 'instagram' }
    ], { onConflict: 'id' });

  if (referencesError) {
    console.error('❌ Failed to create references:', referencesError.message);
    process.exit(1);
  }
  console.log('✅ Inserted References');

  // 4. Create Content Profile
  const { error: profileError } = await supabase
    .from('content_profiles')
    .upsert({
      id: '00000000-0000-0000-0000-000000000005',
      project_id: projectId,
      visual_style: 'Clean, well-lit desk setups with neon accents',
      hooks: ['Have you seen this?', 'Wait until the end...'],
      caption_structure: 'Short hook, 3 bullet points, CTA',
      format_mix: '70% reels, 30% carousels',
      content_pillars: ['Desk setups', 'Productivity', 'Tech Reviews'],
      raw_analysis: { analysis: 'Detailed analysis from Gemini would go here' }
    }, { onConflict: 'project_id' });

  if (profileError) {
    console.error('❌ Failed to create content profile:', profileError.message);
    process.exit(1);
  }
  console.log('✅ Inserted Content Profile');

  // 5. Create Ideas
  const ideaId = '00000000-0000-0000-0000-000000000002';
  await assertOwned('content_ideas', ideaId);
  await assertOwned('content_ideas', '00000000-0000-0000-0000-000000000003');

  const { error: ideasError } = await supabase
    .from('content_ideas')
    .upsert([
      {
        id: ideaId,
        project_id: projectId,
        hook: 'The only keyboard you need',
        caption: 'This keyboard changed my life. 1. Mechanical 2. Wireless 3. RGB',
        hashtags: ['#tech', '#setup'],
        format: 'image',
        visual_prompt: 'A sleek mechanical keyboard with RGB lighting on a wooden desk',
        status: 'approved'
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        project_id: projectId,
        hook: 'My WFH essentials',
        caption: 'Here is what I use every day to stay productive.',
        hashtags: ['#wfh', '#productivity'],
        format: 'carousel',
        visual_prompt: 'A clean minimalist desk setup with a monitor, laptop, and coffee',
        status: 'proposed'
      }
    ]);

  if (ideasError) {
    console.error('❌ Failed to create ideas:', ideasError.message);
    process.exit(1);
  }
  console.log('✅ Inserted Ideas');

  // 6. Create Generated Assets
  const assetId = '00000000-0000-0000-0000-000000000004';
  await assertOwned('generated_assets', assetId);

  const { error: assetsError } = await supabase
    .from('generated_assets')
    .upsert({
      id: assetId,
      project_id: projectId,
      idea_id: ideaId,
      type: 'image',
      status: 'ready',
      media_url: 'https://example.com/keyboard.jpg'
    });

  if (assetsError) {
    console.error('❌ Failed to create generated assets:', assetsError.message);
    process.exit(1);
  }
  console.log('✅ Inserted Generated Assets');

  // 7. Create Scheduled Posts
  // For timestamps, we calculate a day from now.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await assertOwned('scheduled_posts', '00000000-0000-0000-0000-000000000006');

  const { error: postsError } = await supabase
    .from('scheduled_posts')
    .upsert({
      id: '00000000-0000-0000-0000-000000000006',
      project_id: projectId,
      asset_id: assetId,
      platform: 'instagram',
      scheduled_for: tomorrow.toISOString(),
      status: 'scheduled'
    }, { onConflict: 'id' });

  if (postsError) {
    console.error('❌ Failed to create scheduled posts:', postsError.message);
    process.exit(1);
  }
  console.log('✅ Inserted Scheduled Posts');

  console.log('🎉 Database seeding completed successfully!');
}

main().catch(err => {
  console.error('❌ Unexpected error during seeding:', err);
  process.exit(1);
});
