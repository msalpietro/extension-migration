require('dotenv').config({ path: '../.env' });
const contentful = require('contentful-management');
const Promise = require('bluebird');
const get = require('lodash/get');
const set = require('lodash/set');
const isString = require('lodash/isString');
const throttle = require('../util/throttle');
const getEntries = require('../util/getEntries');
const fs = require('fs');

const UPDATED = 'updated';
const FAILED = 'failed';
const PUBLISHED = 'published';

const client = contentful.createClient({
  accessToken: process.env.MANAGEMENT_TOKEN,
});

const updateEntry = async ({ space, entry, fields, delay }) => {
  try {
    const isUpdated = entry.isUpdated();
    let updatedEntry = set(entry, 'fields', fields);
    updatedEntry = await throttle(updatedEntry.update(), delay);
    if (isUpdated) {
      try {
        await throttle(updatedEntry.publish(), delay);
      } catch (error) {
        return UPDATED;
      }
    }
    return PUBLISHED;
  } catch (error) {
    if (error.code === 'VersionMismatch') {
      const currentVersion = await throttle(space.getEntry(get(entry, 'sys.id')), delay);
      updateEntry({ space, currentVersion, fields, delay });
    }
    console.log(error);
    return FAILED;
  }
};

const replaceFields = ({ fields, match, replace }) => (
  Object.entries(fields).reduce((fields, [field, values]) => (
    Object.assign(fields, { [field]: Object.entries(values).reduce((x, [locale, localeValue]) => (
      Object.assign(x, { [locale]: isString(localeValue) ? localeValue.replace(match, replace) : localeValue })
    ), {}) })
  ), {}));

const writeFile = (data) => new Promise((resolve, reject) => {
  fs.writeFile('exported.json', JSON.stringify(data), (err) => {
     if (err) reject(err);
     else resolve(true);
  });
});

const run = async () => {
  try {
    const space = await client.getSpace(process.env.EXPORT_SPACE);
    const match = process.argv[2];
    const replace = process.argv[3];
    const delay = process.argv[4] || 200;

    const query = {
      'query': match,
    };

    const exportedItems = await getEntries({ space, query, limit: 1000, delay });

    await writeFile(exportedItems);

    const counts = { published: 0, updated: 0, failed: 0 };

    for (const entry of exportedItems) {
      const start = new Date();
      const fields = replaceFields({ fields: get(entry, 'fields', {}), match, replace });
      const result = await updateEntry({ space, entry, fields, delay });
      if (result) {
        counts[result] += 1;
        console.log(`${result} - ${entry.sys.id} - ${new Date() - start}ms`)
      }
    }

    console.log(`published ${counts.published}`);
    console.log(`updated ${counts.updated}`);
    console.log(`failed ${counts.failed}`)
  } catch (error) {
    console.log(error);
  }
};

run();
