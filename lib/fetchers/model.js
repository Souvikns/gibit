const Org = (data) => {
  return {
    org_name: data.name,
    org_url: data.html_url,
    avatar_url: data.avatar_url,
  };
};

const Label = (data) => {
  return { id: data.id, url: data.url, name: data.name, color: data.color };
};

const Issue = (data) => {
  return {
    url: data.url,
    repo_url: data.repository_url,
    title: data.title,
    labels: data.labels.map(Label),
    state: data.state,
    body: data.body,
  };
};

module.exports = {
  Org,
  Issue,
  Label,
};
