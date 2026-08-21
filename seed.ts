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

const target = new URL(supabaseUrl);
const localTarget = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
const approvedTargets = (process.env.SEED_TARGET_URLS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (process.env.SEED_ENV !== 'true') {
  console.error('❌ Refusing to seed: SEED_ENV=true is required.');
  process.exit(1);
}

if (!localTarget && !approvedTargets.includes(target.hostname) && !approvedTargets.includes(supabaseUrl)) {
  console.error(`❌ Refusing to seed: target ${supabaseUrl} is not local and not in SEED_TARGET_URLS.`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl as string, supabaseServiceKey as string, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function uploadSvg(
  bucket: string,
  path: string,
  svg: string
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, Buffer.from(svg), {
      contentType: 'image/svg+xml',
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed for ${path}: ${error.message}`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

const SVG = (bg: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${bg}"/>
  <rect x="60" y="824" width="904" height="90" fill="rgba(0,0,0,0.6)"/>
  <text x="512" y="875" font-family="sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle">${label}</text>
</svg>`;

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@viralforge.test';

async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  let page: { users: { id: string; email: string | null }[]; nextPage: number | null } | null = null;
  while (true) {
    const res = await supabase.auth.admin.listUsers(
      page ? { page: page.nextPage ?? 1, perPage: 1000 } : { page: 1, perPage: 1000 }
    );
    if (res.error) throw new Error(res.error.message);
    const paginated = res.data as { users: { id: string; email: string | null }[]; nextPage: number | null } | null;
    const found = paginated?.users.find((u) => u.email === email);
    if (found) return { id: found.id };
    if (!paginated || paginated.nextPage == null) return null;
    page = paginated;
  }
}

async function ensureAdminUser() {
  console.log(`🛡️  Ensuring admin account ${adminEmail}...`);
  let adminId: string;
  const existing = await findAuthUserByEmail(adminEmail);

  if (existing) {
    adminId = existing.id;
  } else {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) {
      console.error(
        `❌ Admin user ${adminEmail} does not exist and SEED_ADMIN_PASSWORD is not set.\n   Set SEED_ADMIN_PASSWORD to have the seed create it, or create the account via /signup first.`
      );
      process.exit(1);
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error(`❌ Failed to create admin user ${adminEmail}:`, error?.message || 'No user returned');
      process.exit(1);
    }
    adminId = data.user.id;
    console.log(`   created auth user ${adminEmail}`);
  }

  // handle_new_user defaults new public.users rows to role='user'; promote idempotently.
  const { error: promoteError } = await supabase
    .from('users')
    .upsert({ id: adminId, email: adminEmail, role: 'admin' }, { onConflict: 'id' });
  if (promoteError) {
    console.error('❌ Failed to set admin role:', promoteError.message);
    process.exit(1);
  }
  console.log('✅ Admin account ready');
}

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Get a user to associate with the seeded data
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!seedUserId) {
    console.error('❌ SEED_USER_ID is required');
    process.exit(1);
  }
  let userData;
  let userError;
  if (uuidRe.test(seedUserId)) {
    const { data, error } = await supabase.auth.admin.getUserById(seedUserId);
    userError = error;
    if (!error && data) userData = data.user;
  } else {
    // Paginate until no next page remains; no arbitrary page limit.
    let page = null;
    while (true) {
      const res = await supabase.auth.admin.listUsers(
        page ? { page: page.nextPage ?? 1, perPage: 1000 } : { page: 1, perPage: 1000 }
      );
      const paginated = res.data as { users: { id: string; email: string | null }[]; nextPage: number | null } | null;
      userError = res.error;
      userData = paginated?.users.find(u => u.email === seedUserId);
      if (userError || userData || paginated?.nextPage == null) break;
      page = paginated;
    }
  }
  if (userError || !userData) {
    console.error(`❌ Failed to fetch user ${seedUserId}:`, userError?.message || 'Not found');
    process.exit(1);
  }
  const userId = userData.id;
  console.log(`👤 Using user ID: ${userId}`);

  await ensureAdminUser();

  const projectId = '00000000-0000-0000-0000-000000000001';

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

  // 1. Create Project
  const { error: projectError } = await supabase
    .from('projects')
    .upsert({
      id: projectId,
      user_id: userId,
      name: 'Tech Review Project',
      description: 'Reviewing latest tech gadgets',
      target_platform: 'instagram',
      brand_voice: 'Informative, energetic, and professional',
    });
  if (projectError) {
    console.error('❌ Failed to create project:', projectError.message);
    process.exit(1);
  }
  console.log('✅ Inserted Project');

  // 2. Create References
  const refIds = [
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000013',
  ];
  for (const id of refIds) await assertOwned('references_table', id);

  const { error: referencesError } = await supabase.from('references_table').upsert(
    [
      { id: refIds[0], project_id: projectId, url: 'https://instagram.com/p/123456', caption: 'Check out this new phone!', platform: 'instagram' },
      { id: refIds[1], project_id: projectId, url: 'https://instagram.com/p/654321', caption: 'The ultimate desk setup 💻', platform: 'instagram' },
      { id: refIds[2], project_id: projectId, url: 'https://instagram.com/p/223344', caption: '5 gadgets you need on your desk', platform: 'instagram' },
      { id: refIds[3], project_id: projectId, url: 'https://instagram.com/reel/998877', caption: 'Watch the keyboard RGB setup', platform: 'instagram' },
    ],
    { onConflict: 'id' }
  );
  if (referencesError) {
    console.error('❌ Failed to create references:', referencesError.message);
    process.exit(1);
  }
  console.log('✅ Inserted References');

  // 3. Create Content Profile
  const { error: profileError } = await supabase
    .from('content_profiles')
    .upsert(
      {
        id: '00000000-0000-0000-0000-000000000005',
        project_id: projectId,
        visual_style: 'Clean, well-lit desk setups with neon accents',
        hooks: ['Have you seen this?', 'Wait until the end...', 'This changed my setup'],
        caption_structure: 'Short hook, 3 bullet points, CTA',
        format_mix: '70% reels, 30% carousels',
        content_pillars: ['Desk setups', 'Productivity', 'Tech Reviews'],
        raw_analysis: { analysis: 'Detailed analysis from Gemini would go here' },
      },
      { onConflict: 'project_id' }
    );
  if (profileError) {
    console.error('❌ Failed to create content profile:', profileError.message);
    process.exit(1);
  }
  console.log('✅ Inserted Content Profile');

  // 4. Create Ideas (image, video, carousel — all approved so assets generate
  //    in review without waiting on a generation run).
  const ideas = [
    {
      id: '00000000-0000-0000-0000-000000000002',
      hook: 'The only keyboard you need',
      caption: 'This keyboard changed my life. 1. Mechanical 2. Wireless 3. RGB',
      hashtags: ['#tech', '#setup'],
      format: 'image',
      visual_prompt: 'A sleek mechanical keyboard with RGB lighting on a wooden desk',
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      hook: 'My WFH essentials',
      caption: 'Here is what I use every day to stay productive.',
      hashtags: ['#wfh', '#productivity'],
      format: 'carousel',
      visual_prompt: 'A clean minimalist desk setup with a monitor, laptop, and coffee',
    },
    {
      id: '00000000-0000-0000-0000-000000000014',
      hook: 'Wait until the RGB syncs',
      caption: 'Watch the keyboard lights follow the music in this close-up.',
      hashtags: ['#rgb', '#desksetup'],
      format: 'video',
      visual_prompt: 'Close-up of a mechanical keyboard cycling through RGB colors',
    },
  ];
  for (const idea of ideas) await assertOwned('content_ideas', idea.id);

  const { error: ideasError } = await supabase.from('content_ideas').upsert(
    ideas.map(({ id, ...rest }) => ({ id, project_id: projectId, status: 'approved', ...rest })),
    { onConflict: 'id' }
  );
  if (ideasError) {
    console.error('❌ Failed to create ideas:', ideasError.message);
    process.exit(1);
  }
  console.log('✅ Inserted Ideas');

  // 5. Create Generated Assets (ready, real renderable URLs)
  const assetIds = {
    image: '00000000-0000-0000-0000-000000000004',
    carousel: '00000000-0000-0000-0000-000000000015',
    video: '00000000-0000-0000-0000-000000000016',
  };
  for (const id of Object.values(assetIds)) await assertOwned('generated_assets', id);

  const imageSvg = SVG('#1e293b', 'The only keyboard you need');
  const imageUrl = await uploadSvg('generated-assets', `${projectId}/${assetIds.image}.svg`, imageSvg);

  const slideSvg = SVG('#0f172a', 'WFH essentials');
  const carouselUrls = [];
  for (let i = 0; i < 3; i++) {
    const path = `${projectId}/${assetIds.carousel}-${i}.svg`;
    carouselUrls.push(await uploadSvg('generated-assets', path, slideSvg.replace('WFH essentials', `Slide ${i + 1}`)));
  }

  // Seeded video defaults to a stable public sample mp4. Override with
  // SEED_VIDEO_URL to point at your own clip; upload a real generated clip
  // under generated-assets when it is available. `ponytail:` this is the
  // only seed asset not served from Supabase Storage.
  const videoUrl =
    process.env.SEED_VIDEO_URL ||
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

  const { data: imageAsset, error: imageAssetError } = await supabase
    .from('generated_assets')
    .upsert(
      {
        id: assetIds.image,
        project_id: projectId,
        idea_id: ideas[0].id,
        type: 'image',
        status: 'ready',
        media_url: imageUrl,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();
  if (imageAssetError) {
    console.error('❌ Failed to create image asset:', imageAssetError.message);
    process.exit(1);
  }
  if (imageAsset) console.log(`   image asset: ${imageAsset.id} -> ${imageUrl}`);

  const { error: carouselAssetError } = await supabase
    .from('generated_assets')
    .upsert(
      {
        id: assetIds.carousel,
        project_id: projectId,
        idea_id: ideas[1].id,
        type: 'carousel',
        status: 'ready',
        media_url: JSON.stringify(carouselUrls),
      },
      { onConflict: 'id' }
    );
  if (carouselAssetError) {
    console.error('❌ Failed to create carousel asset:', carouselAssetError.message);
    process.exit(1);
  }

  const { data: videoAsset, error: videoAssetError } = await supabase
    .from('generated_assets')
    .upsert(
      {
        id: assetIds.video,
        project_id: projectId,
        idea_id: ideas[2].id,
        type: 'video',
        status: 'ready',
        media_url: videoUrl,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();
  if (videoAssetError) {
    console.error('❌ Failed to create video asset:', videoAssetError.message);
    process.exit(1);
  }
  console.log(`   video asset: ${assetIds.video} -> ${videoUrl}`);
  console.log('✅ Inserted Generated Assets');

  // 6. Create Scheduled Posts in mixed states
  const postDay = 24 * 60 * 60 * 1000;
  const tomorrow = new Date(Date.now() + postDay).toISOString();
  const publishedAt = new Date(Date.now() - postDay).toISOString();
  const failedAt = new Date(Date.now() - 2 * postDay).toISOString();

  const posts = [
    { id: '00000000-0000-0000-0000-000000000006', asset_id: assetIds.video, scheduled_for: tomorrow, status: 'scheduled' },
    { id: '00000000-0000-0000-0000-000000000017', asset_id: assetIds.image, scheduled_for: publishedAt, status: 'published' },
    { id: '00000000-0000-0000-0000-000000000018', asset_id: assetIds.carousel, scheduled_for: failedAt, status: 'failed', publish_error: 'Seed mock failure: rate limited' },
  ];
  for (const post of posts) await assertOwned('scheduled_posts', post.id);

  const { error: postsError } = await supabase
    .from('scheduled_posts')
    .upsert(
      posts.map(({ id, ...rest }) => ({ id, project_id: projectId, platform: 'instagram', timezone: 'UTC', ...rest })),
      { onConflict: 'id' }
    );
  if (postsError) {
    console.error('❌ Failed to create scheduled posts:', postsError.message);
    process.exit(1);
  }
  console.log('✅ Inserted Scheduled Posts');

  console.log('🎉 Database seeding completed successfully!');
}

main().catch((err) => {
  console.error('❌ Unexpected error during seeding:', err);
  process.exit(1);
});