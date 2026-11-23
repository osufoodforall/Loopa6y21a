(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const supabase = window.supabase.createClient(
    window.LOOP_SUPABASE_URL,
    window.LOOP_SUPABASE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true } }
  );

  const icons = { Furniture: '🪑', Electronics: '💻', Books: '📚', Kitchen: '🍳', Dorm: '🛏️', Other: '📦' };
  let user = null;
  let listings = [];
  let likes = new Set();
  let requests = [];
  let activeRequest = null;
  let category = 'All';

  const style = document.createElement('style');
  style.textContent = `
    .backend-status{font-size:11px;margin-top:7px;color:#327558}
    .listing-actions{display:flex;gap:7px;margin-top:12px}
    .listing-actions button,.owner-actions button{border:1px solid #dfe6dc;background:#fff;border-radius:7px;padding:8px 10px;color:#335541;font-size:11px;font-weight:700;cursor:pointer}
    .listing-actions button{flex:1}.listing-actions .liked{background:#f8e8e8;color:#a43f45}
    .owner-actions{display:flex;gap:7px;margin-top:9px}.owner-actions button:last-child{color:#a43f45}
    .listing-state{margin-top:10px;padding:9px;border-radius:8px;background:#f4f1eb;color:#655b50;font-size:11px;font-weight:700}
    .listing-state.pending{background:#f7f0dd;color:#765c20}.listing-state.reserved{background:#e7efe4;color:#31583c}
    .field small{display:block;color:#748078;font-weight:400;margin-top:4px}
    .modal-bg{z-index:10}.modal{max-height:88vh;overflow:auto}
    .workflow-card{padding:13px;margin:10px 0;border:1px solid #e4e8df;border-radius:12px;background:#fff}
    .workflow-card h3{font-size:15px;margin:0 0 5px}.workflow-card p{font-size:12px;line-height:1.5;color:#68736b;margin:5px 0}
    .workflow-meta{font-size:11px;color:#7a817a}.workflow-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .workflow-actions button{border:1px solid #dfe6dc;background:#fff;border-radius:8px;padding:8px 10px;color:#335541;font-size:11px;font-weight:700;cursor:pointer}
    .workflow-actions .primary{background:#327558;color:#fff;border-color:#327558}.workflow-actions .danger{color:#a43f45}
    .inbox-tabs{display:flex;gap:8px;margin:12px 0}.inbox-tabs button{border:0;border-radius:20px;padding:8px 12px;background:#f0f2ed;color:#45554b;font-weight:700;cursor:pointer}
    .inbox-tabs button.active{background:#284538;color:white}.conversation{max-height:42vh;overflow:auto;padding:8px 0}
    .message{padding:9px 11px;margin:7px 0;border-radius:10px;background:#f1f4ed;font-size:12px;white-space:pre-wrap}
    .message.mine{background:#e2efe5;margin-left:18%}.message small{display:block;color:#778278;margin-top:5px;font-size:10px}
    .conversation-form{display:flex;gap:8px;align-items:flex-end}.conversation-form textarea{flex:1;min-height:62px}
  `;
  document.head.append(style);

  const status = document.createElement('div');
  status.className = 'backend-status';
  status.textContent = 'Connecting to Loop…';
  $('.head').append(status);

  const inboxButton = document.createElement('button');
  inboxButton.className = 'btn light';
  inboxButton.textContent = 'Requests & messages';
  $('#sell').before(inboxButton);

  const requestDialog = document.createElement('div');
  requestDialog.className = 'modal-bg';
  requestDialog.id = 'requestDialog';
  requestDialog.innerHTML = `
    <form class="modal" id="requestForm">
      <div class="modal-head"><div><div class="eyebrow">One item, one reservation</div><h2 id="requestTitle">Request this item</h2><p id="requestDetails">The seller will confirm availability. Your request temporarily holds the item.</p></div><button type="button" class="close" id="requestClose" aria-label="Close">×</button></div>
      <input id="requestListing" type="hidden">
      <label class="field">Message to the seller<textarea id="requestMessage" maxlength="1500" required>Hi! I’m interested in buying this item. Is it still available?</textarea></label>
      <div class="modal-actions"><button type="button" class="btn light" id="requestCancel">Cancel</button><button type="submit" class="btn">Send request</button></div>
    </form>`;
  document.body.append(requestDialog);

  const inboxDialog = document.createElement('div');
  inboxDialog.className = 'modal-bg';
  inboxDialog.id = 'inboxDialog';
  inboxDialog.innerHTML = `
    <section class="modal" aria-labelledby="inboxTitle">
      <div class="modal-head"><div><div class="eyebrow">Loop marketplace</div><h2 id="inboxTitle">Requests & messages</h2><p>Confirm availability, reserve the item, and arrange pickup privately.</p></div><button type="button" class="close" id="inboxClose" aria-label="Close">×</button></div>
      <nav class="inbox-tabs"><button class="active" data-inbox-tab="requests">Requests</button><button data-inbox-tab="conversation">Conversation</button></nav>
      <div id="inboxContent"></div>
    </section>`;
  document.body.append(inboxDialog);

  function note(text, error = false) {
    status.textContent = text;
    status.style.color = error ? '#a43f45' : '#327558';
  }

  function publicRows() {
    return listings.filter((item) => item.sale_status === 'available' || item.seller_id === user?.id || item.request_buyer_id === user?.id);
  }

  function render() {
    const query = ($('#search')?.value || '').toLowerCase();
    const rows = publicRows()
      .filter((item) => (category === 'All' || item.category === category) && `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query))
      .sort((a, b) => Number(a.distance_miles) - Number(b.distance_miles));

    $('#count').textContent = `${rows.length} ${rows.length === 1 ? 'item' : 'items'}`;
    $('#saved').textContent = listings.filter((item) => item.sale_status === 'available').length;
    $('#pickupCount').textContent = listings.filter((item) => item.sale_status === 'reserved').length;
    $('#empty').classList.toggle('show', rows.length === 0);
    $('#cards').innerHTML = rows.map((item) => {
      const own = item.seller_id === user?.id;
      const mine = item.request_buyer_id === user?.id;
      const state = item.sale_status === 'requested'
        ? `<div class="listing-state pending">${own ? 'A student requested this · confirm availability in Requests & messages' : mine ? 'Request sent · waiting for seller to confirm' : 'Already reserved · request pending'}</div>`
        : item.sale_status === 'reserved'
          ? `<div class="listing-state reserved">${mine ? 'Reserved for you · message the seller to arrange pickup' : 'Already reserved'}</div>`
          : item.sale_status === 'unavailable'
            ? `<div class="listing-state">Already reserved · listing closed</div>` : '';
      const actions = item.sale_status === 'available'
        ? `<div class="listing-actions"><button class="like-action ${likes.has(item.id) ? 'liked' : ''}" data-like="${item.id}">♥ ${item.like_count || 0} interested</button>${own ? '' : `<button class="request-item" data-request="${item.id}">Request item</button>`}</div>`
        : item.sale_status === 'reserved' && mine
          ? `<div class="listing-actions"><button data-conversation="${item.id}">Message seller about pickup</button></div>` : '';
      const ownerActions = own ? `<div class="owner-actions">${item.sale_status === 'available' ? `<button data-edit-listing="${item.id}">Edit listing</button>` : ''}<button data-delete-listing="${item.id}">Remove listing</button></div>` : '';
      return `<article class="card"><div class="photo p${(item.id.charCodeAt(0) % 4) + 1}"><span class="tag">${esc(item.category.toUpperCase())}</span><span aria-hidden="true">${icons[item.category] || icons.Other}</span></div><div class="body"><h3>${esc(item.name)}</h3><p class="description">${esc(item.description)}</p><div class="meta"><span>Campus community</span><span>Campus pickup</span></div><div class="price-row"><span class="price">$${Number(item.price).toFixed(2)}</span><span class="distance">${Number(item.distance_miles).toFixed(1)} mi from center</span></div>${state}${actions}${ownerActions}</div></article>`;
    }).join('');
  }

  async function load() {
    const { data, error } = await supabase.from('loop_listings').select('*,loop_listing_likes(count)').order('created_at', { ascending: false });
    if (error) throw error;
    listings = (data || []).map((item) => ({ ...item, like_count: item.loop_listing_likes?.[0]?.count || 0 }));
    const { data: myLikes, error: likesError } = await supabase.from('loop_listing_likes').select('listing_id').eq('user_id', user.id);
    if (likesError) throw likesError;
    likes = new Set((myLikes || []).map((like) => like.listing_id));
    render();
  }

  async function loadRequests() {
    const { data, error } = await supabase.from('loop_requests').select('*').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order('created_at', { ascending: false });
    if (error) throw error;
    requests = data || [];
    renderInbox();
  }

  function setTab(name) {
    document.querySelectorAll('[data-inbox-tab]').forEach((button) => button.classList.toggle('active', button.dataset.inboxTab === name));
    $('#inboxContent').dataset.view = name;
  }

  function renderInbox() {
    const view = $('#inboxContent').dataset.view || 'requests';
    if (view === 'conversation') {
      renderConversation();
      return;
    }
    if (!requests.length) {
      $('#inboxContent').innerHTML = '<p class="empty show">No item requests yet. Requests from buyers will appear here.</p>';
      return;
    }
    $('#inboxContent').innerHTML = requests.map((request) => {
      const item = listings.find((listing) => listing.id === request.listing_id);
      const title = item?.name || 'Campus item';
      const isSeller = request.seller_id === user.id;
      const label = request.status === 'pending' ? 'Waiting for seller confirmation' : request.status === 'accepted' ? 'Reserved for this buyer' : 'Already reserved · listing closed';
      const response = isSeller && request.status === 'pending'
        ? `<div class="workflow-actions"><button class="primary" data-respond="${request.id}" data-available="true">Yes · confirm and reserve</button><button class="danger" data-respond="${request.id}" data-available="false">No · already reserved</button></div>`
        : request.status === 'accepted'
          ? `<div class="workflow-actions"><button class="primary" data-conversation-request="${request.id}">Arrange pickup & message ${isSeller ? 'buyer' : 'seller'}</button></div>` : '';
      return `<article class="workflow-card"><h3>${esc(title)} · $${Number(item?.price || 0).toFixed(2)}</h3><div class="workflow-meta">${isSeller ? 'Buyer request' : 'Your request'} · ${new Date(request.created_at).toLocaleString()}</div><p>${esc(request.message)}</p><div class="listing-state ${request.status === 'pending' ? 'pending' : request.status === 'accepted' ? 'reserved' : ''}">${label}</div>${response}</article>`;
    }).join('');
  }

  async function renderConversation() {
    const request = requests.find((item) => item.id === activeRequest);
    if (!request) {
      $('#inboxContent').innerHTML = '<p>Select a confirmed request to arrange pickup.</p>';
      return;
    }
    const item = listings.find((listing) => listing.id === request.listing_id);
    if (request.status !== 'accepted') {
      $('#inboxContent').innerHTML = '<p>Messaging opens after the seller confirms the item is available.</p>';
      return;
    }
    const { data, error } = await supabase.from('loop_inquiries').select('*').eq('listing_id', request.listing_id).eq('buyer_id', request.buyer_id).order('created_at', { ascending: true });
    if (error) {
      $('#inboxContent').innerHTML = `<p>${esc(error.message)}</p>`;
      return;
    }
    const conversation = (data || []).map((message) => `<div class="message ${message.sender_id === user.id ? 'mine' : ''}">${esc(message.message)}<small>${message.sender_id === user.id ? 'You' : 'Campus community'} · ${new Date(message.created_at).toLocaleString()}</small></div>`).join('') || '<p>Use this private conversation to agree on a public campus pickup place and any price details.</p>';
    $('#inboxContent').innerHTML = `<h3>${esc(item?.name || 'Campus item')} · $${Number(item?.price || 0).toFixed(2)}</h3><p class="workflow-meta">Private chat · coordinate a public pickup location and time</p><div class="conversation">${conversation}</div><form class="conversation-form" id="messageForm"><textarea id="messageText" maxlength="1500" required placeholder="Suggest a public pickup spot and time…"></textarea><button class="btn" type="submit">Send</button></form>`;
    $('.conversation').scrollTop = $('.conversation').scrollHeight;
    $('#messageForm').onsubmit = async (event) => {
      event.preventDefault();
      const message = $('#messageText').value.trim();
      const result = await supabase.from('loop_inquiries').insert({ listing_id: request.listing_id, buyer_id: request.buyer_id, seller_id: request.seller_id, sender_id: user.id, message });
      if (result.error) return note(result.error.message, true);
      await renderConversation();
      note('Pickup message sent privately.');
    };
  }

  async function openInbox() {
    try {
      await Promise.all([load(), loadRequests()]);
      setTab('requests');
      $('#inboxDialog').classList.add('open');
    } catch (error) { note(error.message, true); }
  }

  (async () => {
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const result = await supabase.auth.signInAnonymously();
        if (result.error) throw result.error;
        session = result.data.session;
      }
      user = session.user;
      await load();
      note('Shared listings are live. Request an item, then confirm availability and arrange pickup in messages.');
      supabase.channel('loop-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loop_listings' }, () => load().catch((error) => note(error.message, true)))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loop_listing_likes' }, () => load().catch((error) => note(error.message, true)))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loop_requests' }, () => { load().catch((error) => note(error.message, true)); if ($('#inboxDialog').classList.contains('open')) loadRequests().catch((error) => note(error.message, true)); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loop_inquiries' }, () => { if ($('#inboxContent').dataset.view === 'conversation') renderConversation(); })
        .subscribe();
    } catch (error) {
      console.error(error);
      note('Backend connection failed: ' + (error.message || 'check Supabase setup and reload.'), true);
    }
  })();

  document.querySelectorAll('.chip').forEach((button) => button.addEventListener('click', () => { category = button.dataset.cat; render(); }));
  $('#search').addEventListener('input', render);

  $('#listingForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!user) return note('Still connecting. Try again in a moment.', true);
    const row = {
      seller_id: user.id,
      name: $('#itemName').value.trim(),
      price: Number($('#itemPrice').value),
      description: $('#itemDescription').value.trim(),
      distance_miles: Number($('#itemDistance').value),
      category: $('#itemCategory').value
    };
    const id = $('#editId').value;
    const result = id
      ? await supabase.from('loop_listings').update(row).eq('id', id).eq('sale_status', 'available')
      : await supabase.from('loop_listings').insert(row);
    if (result.error) return note(result.error.message, true);
    $('#modalBg').classList.remove('open');
    event.currentTarget.reset();
    await load();
    note(id ? 'Listing updated.' : 'Listing posted. Students can now request it.');
  }, true);

  $('#cards').addEventListener('click', async (event) => {
    const like = event.target.closest('[data-like]');
    const requestButton = event.target.closest('[data-request]');
    const conversation = event.target.closest('[data-conversation]');
    const edit = event.target.closest('[data-edit-listing]');
    const remove = event.target.closest('[data-delete-listing]');
    if (like) {
      event.preventDefault(); event.stopImmediatePropagation();
      const result = likes.has(like.dataset.like)
        ? await supabase.from('loop_listing_likes').delete().eq('listing_id', like.dataset.like).eq('user_id', user.id)
        : await supabase.from('loop_listing_likes').insert({ listing_id: like.dataset.like, user_id: user.id });
      if (result.error) note(result.error.message, true); else await load();
      return;
    }
    if (requestButton) {
      $('#requestListing').value = requestButton.dataset.request;
      $('#requestDialog').classList.add('open');
      return;
    }
    if (conversation) {
      await openInbox();
      const request = requests.find((entry) => entry.listing_id === conversation.dataset.conversation && entry.buyer_id === user.id);
      if (request) { activeRequest = request.id; setTab('conversation'); await renderConversation(); }
      return;
    }
    if (edit) {
      const item = listings.find((entry) => entry.id === edit.dataset.editListing);
      if (!item) return;
      $('#editId').value = item.id;
      $('#itemName').value = item.name;
      $('#itemPrice').value = item.price;
      $('#itemDistance').value = item.distance_miles;
      $('#itemDescription').value = item.description;
      $('#itemCategory').value = item.category;
      $('#formTitle').textContent = 'Edit listing';
      $('#modalBg').classList.add('open');
      return;
    }
    if (remove && confirm('Remove this listing and its request history?')) {
      const result = await supabase.from('loop_listings').delete().eq('id', remove.dataset.deleteListing);
      if (result.error) note(result.error.message, true); else { note('Listing removed.'); await load(); }
    }
  });

  $('#requestClose').onclick = $('#requestCancel').onclick = () => $('#requestDialog').classList.remove('open');
  $('#requestForm').onsubmit = async (event) => {
    event.preventDefault();
    const { data, error } = await supabase.rpc('request_loop_item', { p_listing_id: $('#requestListing').value, p_message: $('#requestMessage').value.trim() });
    if (error) return note(error.message, true);
    if (!data) { $('#requestDialog').classList.remove('open'); await load(); return note('Already reserved. This item is no longer available.', true); }
    $('#requestDialog').classList.remove('open');
    event.currentTarget.reset();
    await Promise.all([load(), loadRequests()]);
    note('Request sent. The item is held for you while the seller confirms availability.');
  };

  $('#inboxClose').onclick = () => $('#inboxDialog').classList.remove('open');
  inboxButton.onclick = openInbox;
  document.querySelectorAll('[data-inbox-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.inboxTab)));
  $('#inboxContent').addEventListener('click', async (event) => {
    const respond = event.target.closest('[data-respond]');
    const openChat = event.target.closest('[data-conversation-request]');
    if (respond) {
      const { data, error } = await supabase.rpc('respond_loop_request', { p_request_id: respond.dataset.respond, p_available: respond.dataset.available === 'true' });
      if (error) return note(error.message, true);
      await Promise.all([load(), loadRequests()]);
      note(data?.status === 'accepted' ? 'Item reserved for this buyer. Use messages to arrange pickup.' : 'Marked already reserved and removed from the marketplace.');
    }
    if (openChat) {
      activeRequest = openChat.dataset.conversationRequest;
      setTab('conversation');
      await renderConversation();
    }
  });
})();
