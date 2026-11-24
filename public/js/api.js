async function call(method, path, body, opts = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  createCampaign: (name) => call('POST', '/campaigns', { name }),
  getCampaign: (cid) => call('GET', `/campaigns/${cid}`),
  renameCampaign: (cid, name) => call('PUT', `/campaigns/${cid}`, { name }),
  createBastion: (cid, data, summary) => call('POST', `/campaigns/${cid}/bastions`, { data, summary }),
  getBastion: (cid, bid) => call('GET', `/campaigns/${cid}/bastions/${bid}`),
  saveBastion: (cid, bid, data, summary, version, opts) => call('PUT', `/campaigns/${cid}/bastions/${bid}`, { data, summary, version }, opts),
  deleteBastion: (cid, bid) => call('DELETE', `/campaigns/${cid}/bastions/${bid}`),
};
