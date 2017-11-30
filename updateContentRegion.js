const contentful = require('contentful-management');
const Promise = require('bluebird');
const get = require('lodash/get');
const set = require('lodash/set');

require('dotenv').config();

const throttle = async (fn, time) => {
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

const client = contentful.createClient({
  accessToken: process.env.MANAGEMENT_TOKEN,
});

const GLOBAL_REGION = 'RiMC8DOUQEeeWIkygiacU';
const UPDATED = 'updated';
const FAILED = 'failed';
const PUBLISHED = 'published';

const CONTENT_TYPES = {
  container: {
    geoField: 'geography',
  },
  basicBannerAnnouncement: {
    geoField: 'geography',
  },
  linkBannerAnnouncement: {
    geoField: 'geography',
  },
  standardLandingPage: {
    geoField: 'geography',
  },
  article: {
    geoField: 'publishGeography',
  },
  procedurePage: {
    geoField: 'geography',
  },
  overviewLandingPage: {
    geoField: 'geography',
  },
};

const updateEntry = async (space, entry, region, delay) => {
  try {
    const isUpdated = entry.isUpdated();
    let updatedEntry = entry;
    set(updatedEntry, 'fields.contentRegion.en-US', region);
    updatedEntry = await throttle(updatedEntry.update(), delay);
    if (!isUpdated) {
      try {
        await throttle(updatedEntry.publish(), delay);
      } catch (error) {
        return UPDATED;
      }
    }
    return PUBLISHED;
  } catch (error) {
    if (error.code === 'VersionMismatch') {
      const updatedEntry = await throttle(space.getEntry(get(entry, 'sys.id')), delay);
      updateEntry(space, updatedEntry, region, delay);
    }
    return FAILED;
  }
};

const checkRegion = async (space, entry, delay) => {
  if (entry.isArchived()) return null;
  const contentType = get(entry, 'sys.contentType.sys.id');
  if (Object.keys(CONTENT_TYPES).includes(contentType)) {
    const geos = get(entry, `fields.${get(CONTENT_TYPES, `${contentType}.geoField`)}.en-US`, [])
      .map(geo => get(geo, 'sys.id'));
    if (geos.length === 0) return null;
    const currentRegion = get(entry, 'fields.contentRegion.en-US');
    const futureRegion = !geos.includes(GLOBAL_REGION) && geos.length > 0 ? 'Local' : 'Global';

    if (currentRegion !== futureRegion) {
      return updateEntry(space, entry, futureRegion, delay);
    }
  }
  return null;
};

const getEntries = async ({ space, query, limit = 1000, skip = 0, items = [], delay }) => {
  const response = await throttle(space.getEntries(Object.assign(query, { skip, limit })), delay);
  if (limit + skip < response.total) {
    return getEntries({ space, query, limit, skip: skip + limit, items: [...items, ...response.items], delay });
  }
  return [...items, ...response.items];
};

const run = async () => {
  try {
    const space = await client.getSpace(process.env.EXPORT_SPACE);

    const query = {
      'sys.contentType.sys.id[in]': Object.keys(CONTENT_TYPES).join(','),
      'order': 'sys.updatedAt',
    };

    const exportedItems = await getEntries({ space, query, limit: 1000, delay: 200 });
    const counts = { published: 0, updated: 0, failure: 0 };

    for (const entry of exportedItems) {
      const start = new Date();
      const result = await checkRegion(space, entry, 100);
      if (result) {
        counts[result] = counts[result] + 1;
        console.log(`${result} - ${entry.sys.id} - ${new Date() - start}ms`)
      }
    }

    console.log(`published ${counts.published}`);
    console.log(`updated ${counts.updated}`);
    console.log(`failed ${counts.failure}`)
  } catch (error) {
    console.log(error);
  }
};

run();
