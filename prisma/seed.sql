DELETE FROM campuses WHERE name IN (
  'Downtown University Campus',
  'North Tech College Campus',
  'Innovation Research Park'
);

INSERT INTO campuses (id, name, type, boundary, active, created_at)
VALUES
  (
    'gitm_lucknow',
    'Goel Institute of Technology & Management (GITM), Lucknow',
    'COLLEGE',
    '{"type": "Polygon", "coordinates": [[[81.064, 26.884], [81.080, 26.884], [81.080, 26.898], [81.064, 26.898], [81.064, 26.884]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'bbdu_lucknow',
    'Babu Banarasi Das University (BBDU), Lucknow',
    'UNIVERSITY',
    '{"type": "Polygon", "coordinates": [[[81.048, 26.880], [81.063, 26.880], [81.063, 26.896], [81.048, 26.896], [81.048, 26.880]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'iet_lucknow',
    'Institute of Engineering and Technology (IET), Lucknow',
    'COLLEGE',
    '{"type": "Polygon", "coordinates": [[[80.932, 26.906], [80.950, 26.906], [80.950, 26.922], [80.932, 26.922], [80.932, 26.906]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'amity_lucknow',
    'Amity University, Lucknow Campus',
    'UNIVERSITY',
    '{"type": "Polygon", "coordinates": [[[81.008, 26.853], [81.028, 26.853], [81.028, 26.870], [81.008, 26.870], [81.008, 26.853]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'integral_lucknow',
    'Integral University, Lucknow',
    'UNIVERSITY',
    '{"type": "Polygon", "coordinates": [[[80.988, 26.950], [81.010, 26.950], [81.010, 26.970], [80.988, 26.970], [80.988, 26.950]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'lu_lucknow',
    'University of Lucknow (LU)',
    'UNIVERSITY',
    '{"type": "Polygon", "coordinates": [[[80.925, 26.856], [80.948, 26.856], [80.948, 26.874], [80.925, 26.874], [80.925, 26.856]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'rmlnlu_lucknow',
    'Dr. Ram Manohar Lohiya National Law University (RMLNLU), Lucknow',
    'UNIVERSITY',
    '{"type": "Polygon", "coordinates": [[[80.888, 26.782], [80.910, 26.782], [80.910, 26.800], [80.888, 26.800], [80.888, 26.782]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'iit_kanpur',
    'Indian Institute of Technology Kanpur (IIT Kanpur)',
    'UNIVERSITY',
    '{"type": "Polygon", "coordinates": [[[80.215, 26.498], [80.252, 26.498], [80.252, 26.532], [80.215, 26.532], [80.215, 26.498]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'hbtu_kanpur',
    'Harcourt Butler Technical University (HBTU Kanpur)',
    'UNIVERSITY',
    '{"type": "Polygon", "coordinates": [[[80.292, 26.478], [80.328, 26.478], [80.328, 26.508], [80.292, 26.508], [80.292, 26.478]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'csjmu_kanpur',
    'Chhatrapati Shahu Ji Maharaj University (CSJMU Kanpur)',
    'UNIVERSITY',
    '{"type": "Polygon", "coordinates": [[[80.268, 26.482], [80.298, 26.482], [80.298, 26.512], [80.268, 26.512], [80.268, 26.482]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'gsvm_kanpur',
    'GSVM Medical College & Kanpur City Campus',
    'COLLEGE',
    '{"type": "Polygon", "coordinates": [[[80.300, 26.440], [80.365, 26.440], [80.365, 26.490], [80.300, 26.490], [80.300, 26.440]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'psit_kanpur',
    'Pranveer Singh Institute of Technology (PSIT Kanpur)',
    'COLLEGE',
    '{"type": "Polygon", "coordinates": [[[80.182, 26.432], [80.212, 26.432], [80.212, 26.458], [80.182, 26.458], [80.182, 26.432]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'iit_delhi',
    'Indian Institute of Technology Delhi (IIT Delhi)',
    'UNIVERSITY',
    '{"type": "Polygon", "coordinates": [[[77.180, 28.535], [77.205, 28.535], [77.205, 28.555], [77.180, 28.555], [77.180, 28.535]]]}'::jsonb,
    true,
    NOW()
  ),
  (
    'iit_bombay',
    'Indian Institute of Technology Bombay (IIT Bombay)',
    'UNIVERSITY',
    '{"type": "Polygon", "coordinates": [[[72.900, 19.120], [72.928, 19.120], [72.928, 19.148], [72.900, 19.148], [72.900, 19.120]]]}'::jsonb,
    true,
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  boundary = EXCLUDED.boundary,
  active = EXCLUDED.active;
