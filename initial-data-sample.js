export const CATEGORIES = ['Frontend', 'Backend', 'DevOps', 'Database', 'Security', 'QA & Testing'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const STATUSES = ['Open', 'In Progress', 'Testing', 'Completed'];

export function generateInitialTasks() {
  const assignees = ['Medeu Seidali', 'Alexey Smirnov', 'Elena Rostova', 'Dmitry Kim', 'Anna Volkova'];
  const titles = [
    'Refactor OAuth2 authentication flow',
    'Optimize PostgreSQL indexing for user queries',
    'Implement dark mode toggle in navbar',
    'Fix memory leak in websocket listener',
    'Upgrade React to version 18.3',
    'Set up CI/CD pipeline in GitHub Actions',
    'Add rate limiting to public REST endpoints',
    'Design interactive dashboard charts',
    'Audit npm dependencies for security vulnerabilities',
    'Configure Redis caching layer for API'
  ];

  const tasks = [];

  for (let i = 1; i <= 100; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    const priority = PRIORITIES[i % PRIORITIES.length];
    const status = STATUSES[i % STATUSES.length];
    const assignee = assignees[i % assignees.length];
    const baseTitle = titles[i % titles.length];

    tasks.push({
      id: `TASK-${1000 + i}`,
      title: `${baseTitle} #${i}`,
      category,
      priority,
      status,
      assignee,
      estimatedHours: (i % 8) + 2,
      createdAt: new Date(Date.now() - i * 3600000 * 12).toISOString().split('T')[0],
      description: `Detailed documentation for TASK-${1000 + i}: Ensure full test coverage, handle edge cases, and verify accessibility compliance. Needs review by ${assignee}.`
    });
  }

  return tasks;
}
