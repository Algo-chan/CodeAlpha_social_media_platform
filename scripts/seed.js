const bcrypt = require('bcryptjs');
const { sequelize, User, Post, Comment, Like, Follow } = require('../src/models');

/**
 * Seed database with demo users, posts, comments, likes, and follows.
 * @returns {Promise<Object>} Summary of created entities
 */
async function seedDatabase() {
  await sequelize.sync({ force: true });

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Demo Users
  const usersData = [
    {
      username: 'alex_tech',
      email: 'alex@example.com',
      password_hash: passwordHash,
      bio: 'Full-stack developer building open source tools and scalable systems. Passionate about Node.js and distributed architectures.',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    },
    {
      username: 'sarah_design',
      email: 'sarah@example.com',
      password_hash: passwordHash,
      bio: 'UI/UX designer & design systems enthusiast. Turning complex problems into intuitive, delightful interfaces.',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
    {
      username: 'elena_photo',
      email: 'elena@example.com',
      password_hash: passwordHash,
      bio: 'Visual artist and landscape photographer. Capturing the world one frame at a time.',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
    {
      username: 'marcus_dev',
      email: 'marcus@example.com',
      password_hash: passwordHash,
      bio: 'Backend engineer and DevOps tinkerer. Loving Rust, Docker, and high-performance databases.',
      avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
    },
  ];

  const users = await User.bulkCreate(usersData, { returning: true });
  const [alex, sarah, elena, marcus] = users;

  // 2. Demo Posts
  const postsData = [
    {
      user_id: alex.id,
      content: 'Just migrated our core services to a unified API gateway. Latency dropped by 40% and developer ergonomics are so much better. Always question architectural complexity before scaling up! 🚀 #backend #webdev',
      image_url: null,
    },
    {
      user_id: sarah.id,
      content: 'Designing accessible color palettes isn’t just about contrast ratios—it is about emotional resonance and context. Here is our new dark mode design system preview! 🎨✨',
      image_url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800',
    },
    {
      user_id: elena.id,
      content: 'Golden hour in the mountains yesterday. The lighting was pure magic. Shot on 35mm f/1.4. 🏔️📷',
      image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800',
    },
    {
      user_id: marcus.id,
      content: 'Writing tests before code completely changed my perspective on software design. If your code is hard to test, it is probably doing too much. Modular architecture wins every single time.',
      image_url: null,
    },
    {
      user_id: alex.id,
      content: 'Deep dive into SQLite concurrency today: WAL (Write-Ahead Logging) mode is incredible for read-heavy workloads. SQLite is often all you need! 💡',
      image_url: null,
    },
    {
      user_id: sarah.id,
      content: 'Typography rule #1: Good typography goes unnoticed; bad typography screams at the user. Always prioritize legibility and rhythm. #design #typography',
      image_url: null,
    },
    {
      user_id: elena.id,
      content: 'Urban symmetry in the rain. Reflections on wet asphalt create natural mirrors everywhere. 🌧️🏙️',
      image_url: 'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?w=800',
    },
    {
      user_id: marcus.id,
      content: 'Automated our staging CI/CD pipeline down to 90 seconds. Fast feedback loops keep developers in flow state. Never underestimate developer productivity investments. ⚡',
      image_url: null,
    },
    {
      user_id: alex.id,
      content: 'Excited to share the first public alpha of our new open-source social media platform! Built with Express, SQLite, and modern vanilla web standards. Give it a spin! 🎉',
      image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
    },
  ];

  const posts = await Post.bulkCreate(postsData, { returning: true });

  // 3. Comments (top-level and replies)
  const comment1 = await Comment.create({
    post_id: posts[0].id,
    user_id: sarah.id,
    content: "Couldn't agree more! Simpler architectures mean fewer incident calls at 2 AM.",
  });

  await Comment.create({
    post_id: posts[0].id,
    user_id: marcus.id,
    parent_comment_id: comment1.id,
    content: 'Amen to that! Keep it simple, scale when measured.',
  });

  const comment3 = await Comment.create({
    post_id: posts[2].id,
    user_id: alex.id,
    content: 'Breathtaking shot Elena! What camera body are you shooting with?',
  });

  await Comment.create({
    post_id: posts[2].id,
    user_id: elena.id,
    parent_comment_id: comment3.id,
    content: 'Thanks Alex! Using a Sony A7 IV with a Sigma 35mm f/1.4.',
  });

  await Comment.create({
    post_id: posts[1].id,
    user_id: alex.id,
    content: 'The dark mode contrast is super crisp. Love the subtle purple accents.',
  });

  await Comment.create({
    post_id: posts[7].id,
    user_id: elena.id,
    content: '90 seconds is lightning fast! What runner configuration are you using?',
  });

  // 4. Likes
  const likesData = [
    { user_id: sarah.id, post_id: posts[0].id },
    { user_id: marcus.id, post_id: posts[0].id },
    { user_id: alex.id, post_id: posts[1].id },
    { user_id: elena.id, post_id: posts[1].id },
    { user_id: alex.id, post_id: posts[2].id },
    { user_id: sarah.id, post_id: posts[2].id },
    { user_id: marcus.id, post_id: posts[2].id },
    { user_id: alex.id, post_id: posts[3].id },
    { user_id: sarah.id, post_id: posts[7].id },
  ];

  await Like.bulkCreate(likesData);

  // 5. Follow Relationships
  const followsData = [
    { follower_id: alex.id, following_id: sarah.id },
    { follower_id: alex.id, following_id: marcus.id },
    { follower_id: sarah.id, following_id: alex.id },
    { follower_id: sarah.id, following_id: elena.id },
    { follower_id: elena.id, following_id: alex.id },
    { follower_id: marcus.id, following_id: alex.id },
    { follower_id: marcus.id, following_id: sarah.id },
  ];

  await Follow.bulkCreate(followsData);

  return {
    users: users.length,
    posts: posts.length,
    comments: 6,
    likes: likesData.length,
    follows: followsData.length,
  };
}

if (require.main === module) {
  seedDatabase()
    .then((summary) => {
      console.log('Database seeded successfully:');
      console.log(`- Users: ${summary.users}`);
      console.log(`- Posts: ${summary.posts}`);
      console.log(`- Comments: ${summary.comments}`);
      console.log(`- Likes: ${summary.likes}`);
      console.log(`- Follows: ${summary.follows}`);
      console.log('\nDemo credentials:');
      console.log('Username: alex_tech, sarah_design, elena_photo, or marcus_dev');
      console.log('Password: password123');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to seed database:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
