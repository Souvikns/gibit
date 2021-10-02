export const orgDetails = (data) => {
  return {
    org_name: data.name,
    org_url: data.html_url,
    avatar_url: data.avatar_url
  }
} 