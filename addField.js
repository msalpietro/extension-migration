const contentful = require('contentful-management');
const Promise = require('bluebird');
const get = require('lodash/get');

require('dotenv').config();

const client = contentful.createClient({
  accessToken: process.env.MANAGEMENT_TOKEN,
});

const addField = async (ct) => {
  if (!ct.fields.find(field => field.id === 'contentRegion')) {
    ct.fields.push({
      id: 'contentRegion',
      name: 'Content Region',
      type: 'Symbol',
      localized: false,
      required: false,
      validations: [{
        in: [
          'Global',
          'Local',
        ],
      }],
      disabled: false,
      omitted: false,
    });
    return ct.update().then(updated => updated.publish());
  }
  return ct;
}

const migrate = async () => {
  try {
    const exportSpace = await client.getSpace(process.env.EXPORT_SPACE);

    const query = {
      'sys.id[in]': process.argv.slice(2).join(','),
    };

    const exportedItems = await exportSpace.getContentTypes(query).then(x => x.items);

    const updatedItems = await Promise.all(exportedItems.map(ct => addField(ct)));
  } catch (error) {
    console.log(error);
  }
}

migrate();
  // .catch(error => console.error(error));
