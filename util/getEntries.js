const throttle = require('./throttle');

module.exports = async ({ space, query, limit = 1000, skip = 0, items = [], delay }) => {
  const response = await throttle(space.getEntries(Object.assign(query, { skip, limit })), delay);
  if (limit + skip < response.total) {
    return getEntries({ space, query, limit, skip: skip + limit, items: [...items, ...response.items], delay });
  }
  return [...items, ...response.items];
};
