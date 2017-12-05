require('dotenv').config({ path: '../.env' });
const contentful = require('contentful-management');
const Promise = require('bluebird');
const get = require('lodash/get');

const client = contentful.createClient({
  accessToken: process.env.MANAGEMENT_TOKEN,
});

const merge = (existing, exported) => Object.assign(existing, exported, { sys: existing.sys });
const match = (existing, exported, key = 'sys.id') => existing.find(x => get(x, key) === get(exported, key));

const importItems = ({ importSpace, exportedItems, existingItems }) => (
  exportedItems.map((exportedItem) => {
    const existingItem = match(existingItems, exportedItem, 'name');
    if (existingItem) {
      const updatedItem = merge(existingItem, exportedItem);
      return updatedItem.update()
        .then((x) => (console.log(`${x.name} - updated`), x))
        .catch((error) => console.log(`${exportedItem.name} - error updating - ${error.name}`, false));
    }
    return importSpace.createRole(exportedItem)
      .then((x) => (console.log(`${x.name} - created`), x))
      .catch((error) => console.log(`${exportedItem.name} - error creating - ${error.name}`, false));
  })
);

const migrate = async () => {
  const [exportSpace, importSpace] = await Promise.all([
    client.getSpace(process.env.EXPORT_SPACE),
    client.getSpace(process.env.IMPORT_SPACE),
  ]);

  const name = process.argv.slice(2)[0];
  const nameFilter = (x) => (x.name === name);

  try {
    const [exportedItems, existingItems] = await Promise.all([
      exportSpace.getRoles().then(x => x.items.filter(nameFilter)),
      importSpace.getRoles().then(x => x.items.filter(nameFilter)),
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
