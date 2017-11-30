const contentful = require('contentful-management');
const Promise = require('bluebird');
const get = require('lodash/get');

require('dotenv').config();

const client = contentful.createClient({
  accessToken: process.env.MANAGEMENT_TOKEN,
});

const merge = (existing, exported) => Object.assign(existing, exported, { sys: existing.sys });
const match = (existing, exported, key = 'sys.id') => existing.find(x => get(x, key) === get(exported, key));

const importItems = ({ importSpace, exportedItems, existingItems }) => (
  exportedItems.map((exportedItem) => {
    const existingItem = match(existingItems, exportedItem);
    if (existingItem) {
      const updatedItem = merge(existingItem, exportedItem);
      return updatedItem.update()
        .then((x) => x.publish())
        .then((x) => (console.log(`${x.sys.id} - updated`), x))
        .catch((error) => (console.log(`${exportedItem.sys.id} - error updating - ${error.name}`)), false);
    }
    return importSpace.createEntryWithId(exportedItem.sys.contentType.sys.id, exportedItem.sys.id, { fields: exportedItem.fields })
      .then((x) => x.publish())
      .then((x) => (console.log(`${x.sys.id} - created`), x))
      .catch((error) => (console.log(`${exportedItem.sys.id} - error creating - ${error.name}`)), false);
  })
);

const migrate = async () => {
  const [exportSpace, importSpace] = await Promise.all([
    client.getSpace(process.env.EXPORT_SPACE),
    client.getSpace(process.env.IMPORT_SPACE),
  ]);

  const query = {
    'sys.id[in]': process.argv.slice(2).join(','),
  };

  try {
    const [exportedItems, existingItems] = await Promise.all([
      exportSpace.getEntries(query).then(x => x.items),
      importSpace.getEntries(query).then(x => x.items),
    ]);

    const importedItems = await Promise.all(importItems({
      importSpace,
      exportedItems,
      existingItems,
    }));

    return true;
  } catch (error) {
    console.log(error);
  }
}

migrate();
