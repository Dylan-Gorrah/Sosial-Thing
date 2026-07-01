-- SoDev Badge Seed Data
-- Run after 001_initial_schema.sql

INSERT INTO badges (name, description, icon, tier, requirement, rarity) VALUES
-- Profile
('Profile Complete',  'Complete your profile with bio, location, and website', '👤', 'bronze',    'complete_profile',       'common'),
('Avatar Uploaded',   'Upload a profile picture',                               '🖼️', 'bronze',    'upload_avatar',           'common'),
-- Projects
('First Project',     'Share your first project',                               '🚀', 'bronze',    'first_project',           'common'),
('Star Attraction',   'Get 100 stars on a single project',                      '⭐', 'gold',      'project_100_stars',       'rare'),
('GitHub Pro',        'Link 5 projects to GitHub',                              '💻', 'silver',    'five_github_projects',    'common'),
('Tech Stack Master', 'Use 10 different technologies',                          '🔧', 'silver',    'ten_technologies',        'rare'),
-- Community
('Helpful Commenter', 'Get 50 likes on your comments',                          '💬', 'silver',    'fifty_comment_likes',     'common'),
('Active Rater',      'Rate 100 posts',                                         '⭐', 'bronze',    'hundred_ratings',         'common'),
('Idea Generator',    'Share 10 ideas',                                         '💡', 'bronze',    'ten_ideas',               'common'),
('Thread Master',     'Post 25 comments',                                       '🧵', 'bronze',    'twenty_five_threads',     'common'),
-- Clout
('Clout Chaser',      'Reach 1,000 clout',                                      '🔥', 'silver',    'thousand_clout',          'common'),
('Clout King',        'Reach 5,000 clout',                                      '👑', 'gold',      'five_thousand_clout',     'rare'),
('Clout Legend',      'Reach 10,000 clout',                                     '🌟', 'platinum',  'ten_thousand_clout',      'epic'),
('Top Ten',           'Rank in the top 10 users',                               '🏆', 'platinum',  'top_ten_rank',            'epic'),
-- Streaks
('Week Warrior',      'Maintain a 7-day activity streak',                       '📅', 'bronze',    'seven_day_streak',        'common'),
('Month Master',      'Maintain a 30-day activity streak',                      '📆', 'silver',    'thirty_day_streak',       'rare'),
('Year Champion',     'Maintain a 365-day activity streak',                     '🗓️', 'legendary', 'year_streak',             'legendary'),
-- Specialty
('Frontend Focus',    'Share 5 frontend projects',                              '🎨', 'bronze',    'five_frontend',           'common'),
('Backend Builder',   'Share 5 backend projects',                               '⚙️', 'bronze',    'five_backend',            'common'),
('AI Innovator',      'Share 3 AI/ML projects',                                 '🤖', 'gold',      'three_ai_projects',       'rare'),
('Mobile Developer',  'Share 3 mobile projects',                                '📱', 'silver',    'three_mobile',            'common'),
-- Social
('Rising Star',       'Get 10 followers',                                       '⭐', 'bronze',    'ten_followers',           'common'),
('Popular',           'Get 50 followers',                                       '👥', 'silver',    'fifty_followers',         'rare'),
('Influencer',        'Get 200 followers',                                      '🌟', 'gold',      'two_hundred_followers',   'epic'),
-- Fun
('Night Owl',         'Post between midnight and 5 AM',                         '🦉', 'bronze',    'night_owl',               'rare'),
('Early Bird',        'Post between 5 AM and 8 AM',                             '🐦', 'bronze',    'early_bird',              'rare'),
('Weekend Warrior',   'Post 5 projects on weekends',                            '🏋️', 'silver',    'weekend_warrior',         'common'),
-- Secret
('Pioneer',           'Be among the first 100 users',                           '🎖️', 'platinum',  'first_hundred',           'secret'),
('Perfectionist',     'Get 10 perfect 5-star ratings',                          '✨', 'gold',      'ten_perfect_scores',      'rare'),
('Jack of All Trades','Post in 8 different categories',                         '🎭', 'silver',    'eight_categories',        'rare')
ON CONFLICT (name) DO NOTHING;
