const form = document.getElementById('boxForm');
const boxList = document.getElementById('boxGrid');
const searchInput = document.getElementById('search');
const feedback = document.getElementById('feedback');
let isEditing = false;
let currentEditId = null;

function getToken() {
  return localStorage.getItem('token');
}

async function loadBoxes(query = '') {
  try {
    const token = getToken();
    if (!token) throw new Error('Not authenticated. Please log in.');

    const res = await fetch('/api/boxes', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch boxes');
    const boxes = await res.json();

    // filter
    const filteredBoxes = query
      ? boxes.filter(
          box =>
            box.label.text.toLowerCase().includes(query.toLowerCase()) ||
            box.destination.toLowerCase().includes(query.toLowerCase())
        )
      : boxes;

    boxList.innerHTML = '';
    filteredBoxes.forEach(box => {
      // parent grid container
      const parent = document.createElement('div');
      parent.className = 'parent';
      // set background color from picker
      parent.style.backgroundColor = box.label.color;

      // Div1: photo
      const div1 = document.createElement('div');
      div1.className = 'div1';
      if (box.photo) {
        const img = document.createElement('img');
        img.src = `uploads/${box.photo}`;
        img.alt = 'Box photo';
        img.style.width = '100%';
        img.style.borderRadius = '6px';
        div1.appendChild(img);
      }
      parent.appendChild(div1);

      // Div2: label text only
      const div2 = document.createElement('div');
      div2.className = 'div2';
      div2.innerHTML = `<strong>Label:</strong> "${box.label.text}"`;
      parent.appendChild(div2);

      // Div3: items
      const div3 = document.createElement('div');
      div3.className = 'div3';
      div3.innerHTML = `<strong>Items:</strong><br>${box.items.join(', ')}`;
      parent.appendChild(div3);

      // Div4: destination
      const div4 = document.createElement('div');
      div4.className = 'div4';
      div4.innerHTML = `<strong>Destination:</strong><br>${box.destination}`;
      parent.appendChild(div4);

      // actions (edit/delete) hidden until hover/press
      const actions = document.createElement('div');
      actions.className = 'box-actions';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.innerHTML = '🖉';
      editBtn.onclick = () => editBox(box.id);
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.innerHTML = '❌';
      deleteBtn.onclick = () => deleteBox(box.id);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      parent.appendChild(actions);

      boxList.appendChild(parent);
    });
  } catch (err) {
    feedback.textContent = `Error: ${err.message}`;
  }
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  feedback.textContent = '';
  try {
    const token = getToken();
    if (!token) throw new Error('Not authenticated. Please log in.');

    // upload photo if present
    const fileInput = document.getElementById('photo');
    let photoFilename = '';
    if (fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('photo', fileInput.files[0]);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!uploadRes.ok) throw new Error('File upload failed');
      photoFilename = (await uploadRes.json()).filename;
    }

    // build box payload
    const box = {
      label: {
        color: document.getElementById('labelColor').value,
        text: document.getElementById('labelText').value
      },
      items: document
        .getElementById('items')
        .value.split(',')
        .map(i => i.trim())
        .filter(i => i),
      destination: document.getElementById('destination').value,
      photo: photoFilename
    };

    if (!box.label.text || !box.destination || !box.items.length) {
      throw new Error('All fields except photo are required');
    }

    const url = isEditing ? `/api/boxes/${currentEditId}` : '/api/boxes';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(box)
    });
    if (!res.ok) throw new Error('Failed to save box');

    // reset form if updating
    if (isEditing) {
      isEditing = false;
      currentEditId = null;
      form.querySelector('button').textContent = 'Add Box';
      document.getElementById('photoPreview').innerHTML = '';
    }

    form.reset();
    loadBoxes();
    feedback.textContent = 'Box saved successfully!';
  } catch (err) {
    feedback.textContent = `Error: ${err.message}`;
  }
});

window.editBox = async id => {
  try {
    const token = getToken();
    if (!token) throw new Error('Not authenticated. Please log in.');

    const res = await fetch('/api/boxes', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch boxes');
    const boxes = await res.json();
    const box = boxes.find(b => b.id === id);
    if (!box) throw new Error('Box not found');

    document.getElementById('labelColor').value = box.label.color;
    document.getElementById('labelText').value = box.label.text;
    document.getElementById('items').value = box.items.join(', ');
    document.getElementById('destination').value = box.destination;
    document.getElementById('photoPreview').innerHTML = box.photo
      ? `<img src="uploads/${box.photo}" width="150" alt="Current photo">`
      : '';

    isEditing = true;
    currentEditId = id;
    form.querySelector('button').textContent = 'Update Box';
  } catch (err) {
    feedback.textContent = `Error: ${err.message}`;
  }
};

window.deleteBox = async id => {
  try {
    const token = getToken();
    if (!token) throw new Error('Not authenticated. Please log in.');

    const res = await fetch(`/api/boxes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to delete box');

    loadBoxes();
    feedback.textContent = 'Box deleted successfully!';
  } catch (err) {
    feedback.textContent = `Error: ${err.message}`;
  }
};

searchInput.addEventListener('input', () => loadBoxes(searchInput.value));

// redirect if not authenticated
if (!getToken()) {
  window.location.href = '/login.html';
}

// initial load
loadBoxes();
