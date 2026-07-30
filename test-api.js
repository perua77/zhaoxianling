const http = require('http');

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, (res) => {
      let response = '';
      res.on('data', (chunk) => { response += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(response));
        } catch (e) {
          resolve({ raw: response, status: res.statusCode });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let response = '';
      res.on('data', (chunk) => { response += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(response));
        } catch (e) {
          resolve({ raw: response, status: res.statusCode });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function main() {
  console.log('=== 测试登录 ===\n');

  // 1. 候选人登录
  console.log('1. 候选人登录 (13344558370 / pppqqq):');
  try {
    const candidate = await apiPost('/api/auth/login', {
      email: '13344558370@zhaoxianling.cn',
      password: 'pppqqq',
    });
    console.log(JSON.stringify(candidate, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }

  console.log('\n---\n');

  // 2. 招聘者登录
  console.log('2. 招聘者登录 (12255874221@qq.com / abc111):');
  try {
    const recruiter = await apiPost('/api/auth/login', {
      email: '12255874221@qq.com',
      password: 'abc111',
    });
    console.log(JSON.stringify(recruiter, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }

  console.log('\n---\n');

  // 3. 面试官登录
  console.log('3. 面试官登录 (111@11.com / pppqqq):');
  try {
    const interviewer = await apiPost('/api/auth/login', {
      email: '111@11.com',
      password: 'pppqqq',
    });
    console.log(JSON.stringify(interviewer, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }

  console.log('\n---\n');

  // 4. 推荐人登录
  console.log('4. 推荐人登录 (11133@qq.com / pppqqq):');
  try {
    const referrer = await apiPost('/api/auth/login', {
      email: '11133@qq.com',
      password: 'pppqqq',
    });
    console.log(JSON.stringify(referrer, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }

  console.log('\n---\n');

  // 5. 查看所有 profiles
  console.log('5. 所有 profiles:');
  try {
    const profiles = await apiGet('/api/debug/all-profiles');
    console.log(JSON.stringify(profiles, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

main().catch(console.error);