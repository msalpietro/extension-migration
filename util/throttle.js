module.exports = async (fn, time) => {
  const [result] = await Promise.all([
    fn,
    new Promise((resolve) => {
      const wait = setTimeout(() => {
        clearTimeout(wait);
        resolve()
      }, time)
    }),
  ]);
  return result;
};
