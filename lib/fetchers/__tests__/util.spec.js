const {queryConstructor} = require('../util');

describe('Query Constructor', () => {
  test('should return custom query string', async () => {
    const query = queryConstructor({
      queryString: 'org:Tech-Phantoms'
    });
    expect(query).toMatch('org:Tech-Phantoms');
  })

  test('should construct query from orgname', async () => {
    const query = queryConstructor({orgName: 'asyncapi'});
    expect(query).toMatch('org:asyncapi');
  })

  test('should construct query from parameter', async () => {
    const query = queryConstructor({
      orgName: 'asyncapi',
      queryParams: ['is:open']
    })
    expect(query).toMatch('org:asyncapi+is:open');
  })
  
  
})

