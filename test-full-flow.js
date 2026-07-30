const http = require('http');

const BASE = { hostname: 'localhost', port: 3001 };

function apiPost(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      ...BASE,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    };
    const req = http.request(options, (res) => {
      let response = '';
      res.on('data', (chunk) => { response += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(response)); } catch (e) { resolve({ raw: response, status: res.statusCode }); }
      });
    });
    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

function apiGet(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = { ...BASE, path, method: 'GET', headers };
    const req = http.request(options, (res) => {
      let response = '';
      res.on('data', (chunk) => { response += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(response)); } catch (e) { resolve({ raw: response, status: res.statusCode }); }
      });
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function login(email, password) {
  const result = await apiPost('/api/auth/login', { email, password });
  if (result.success) {
    return { userId: result.user.id, roles: result.user.roles, token: result.session.access_token };
  }
  console.log(`  ❌ 登录失败: ${result.error}`);
  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('招贤令 全链路功能测试');
  console.log('='.repeat(60));

  // ===== 1. 登录各身份 =====
  console.log('\n📋 第一步：登录各身份账号');
  
  console.log('\n1.1 候选人登录...');
  const candidate = await login('13344558370@zhaoxianling.cn', 'pppqqq');
  if (!candidate) { console.log('❌ 候选人登录失败，终止测试'); return; }
  console.log(`  ✅ 候选人 ID: ${candidate.userId}, roles: ${JSON.stringify(candidate.roles)}`);

  console.log('\n1.2 招聘者登录...');
  const recruiter = await login('1255874221@qq.com', 'abc111');
  if (!recruiter) { console.log('❌ 招聘者登录失败，终止测试'); return; }
  console.log(`  ✅ 招聘者 ID: ${recruiter.userId}, roles: ${JSON.stringify(recruiter.roles)}`);

  console.log('\n1.3 面试官登录...');
  const interviewer = await login('111@11.com', 'pppqqq');
  if (!interviewer) { console.log('❌ 面试官登录失败，终止测试'); return; }
  console.log(`  ✅ 面试官 ID: ${interviewer.userId}, roles: ${JSON.stringify(interviewer.roles)}`);

  console.log('\n1.4 推荐人登录...');
  const referrer = await login('11133@11.com', 'pppqqq');
  if (!referrer) {
    console.log('  ⚠️ 推荐人登录失败（邮箱未确认），跳过推荐人测试');
  } else {
    console.log(`  ✅ 推荐人 ID: ${referrer.userId}, roles: ${JSON.stringify(referrer.roles)}`);
  }

  // ===== 2. 候选人侧功能测试 =====
  console.log('\n' + '='.repeat(60));
  console.log('📋 第二步：候选人侧功能测试');

  // 2.1 首页 - 获取岗位列表
  console.log('\n2.1 首页 - 获取岗位列表...');
  const jobsList = await apiGet('/api/recruiter/jobs');
  console.log(`  岗位列表: ${JSON.stringify(jobsList).substring(0, 200)}`);

  // 2.2 岗位列表 - 筛选
  console.log('\n2.2 岗位列表筛选测试...');
  const jobsFiltered = await apiGet('/api/recruiter/jobs?domain=supermarket');
  console.log(`  行业筛选(supermarket): ${JSON.stringify(jobsFiltered).substring(0, 200)}`);

  // 2.3 获取某个岗位详情
  console.log('\n2.3 岗位详情...');
  if (jobsList.data && jobsList.data.length > 0) {
    const jobId = jobsList.data[0].id;
    console.log(`  使用岗位 ID: ${jobId}`);

    // 2.4 投递申请
    console.log('\n2.4 投递申请...');
    const applyResult = await apiPost('/api/applications', {
      job_id: jobId,
      candidate_id: candidate.userId,
      full_name: '候选人1',
      phone: '13344558370',
      email: '13344558370@zhaoxianling.cn',
      self_introduction: '测试投递 - 自我介绍',
      cover_letter: '测试投递 - 自荐信',
    });
    console.log(`  投递结果: ${JSON.stringify(applyResult).substring(0, 300)}`);

    // 2.5 我的申请
    console.log('\n2.5 我的申请列表...');
    const myApps = await apiGet(`/api/applications?candidate_id=${candidate.userId}`);
    console.log(`  我的申请: ${JSON.stringify(myApps).substring(0, 300)}`);

    // 2.6 面试安排
    console.log('\n2.6 面试安排...');
    const interviews = await apiGet(`/api/candidate/interviews?candidate_id=${candidate.userId}`);
    console.log(`  面试列表: ${JSON.stringify(interviews).substring(0, 200)}`);

    // 2.7 消息中心
    console.log('\n2.7 消息中心...');
    const messages = await apiGet(`/api/messages?recipient_id=${candidate.userId}`);
    console.log(`  消息列表: ${JSON.stringify(messages).substring(0, 200)}`);

    // 2.8 个人中心
    console.log('\n2.8 个人中心...');
    const profile = await apiGet(`/api/profile/${candidate.userId}`);
    console.log(`  个人信息: ${JSON.stringify(profile).substring(0, 200)}`);
  }

  // ===== 3. 招聘者侧功能测试 =====
  console.log('\n' + '='.repeat(60));
  console.log('📋 第三步：招聘者侧功能测试');

  // 3.1 发布岗位
  console.log('\n3.1 发布新岗位...');
  const newJob = await apiPost('/api/recruiter/jobs', {
    title: '测试岗位-超市收银员',
    description: '负责超市收银工作',
    domain: 'supermarket',
    employment_type: 'fulltime',
    salary_min: 3000,
    salary_max: 5000,
    salary_unit: '月',
    location: '北京市朝阳区',
    province: '北京',
    city: '北京市',
    district: '朝阳区',
    requirements: '有收银经验者优先',
    recruiter_id: recruiter.userId,
  });
  console.log(`  发布结果: ${JSON.stringify(newJob).substring(0, 300)}`);

  // 3.2 岗位管理
  console.log('\n3.2 岗位管理...');
  const myJobs = await apiGet(`/api/recruiter/jobs?recruiter_id=${recruiter.userId}`);
  console.log(`  我的岗位: ${JSON.stringify(myJobs).substring(0, 300)}`);

  // 3.3 投递管理 - 查看申请列表
  console.log('\n3.3 投递管理 - 申请列表...');
  const applications = await apiGet('/api/recruiter/applications');
  console.log(`  申请列表: ${JSON.stringify(applications).substring(0, 400)}`);

  // 3.4 数据看板
  console.log('\n3.4 数据看板...');
  const dashboard = await apiGet('/api/recruiter/dashboard');
  console.log(`  看板数据: ${JSON.stringify(dashboard).substring(0, 300)}`);

  // 3.5 面试管理
  console.log('\n3.5 面试管理...');
  const allInterviews = await apiGet('/api/recruiter/interviews');
  console.log(`  所有面试: ${JSON.stringify(allInterviews).substring(0, 300)}`);

  // 3.6 招聘者消息
  console.log('\n3.6 招聘者消息...');
  const recruiterMsgs = await apiGet(`/api/messages?recipient_id=${recruiter.userId}`);
  console.log(`  消息列表: ${JSON.stringify(recruiterMsgs).substring(0, 200)}`);

  // ===== 4. 面试官侧功能测试 =====
  console.log('\n' + '='.repeat(60));
  console.log('📋 第四步：面试官侧功能测试');

  // 4.1 面试官待办任务
  console.log('\n4.1 面试官待办任务...');
  const interviewerTasks = await apiGet('/api/recruiter/interviewer-tasks');
  console.log(`  待办任务: ${JSON.stringify(interviewerTasks).substring(0, 300)}`);

  // 4.2 面试官消息
  console.log('\n4.2 面试官消息...');
  const interviewerMsgs = await apiGet(`/api/messages?recipient_id=${interviewer.userId}`);
  console.log(`  消息列表: ${JSON.stringify(interviewerMsgs).substring(0, 200)}`);

  // ===== 5. 推荐人侧功能测试 =====
  if (referrer) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 第五步：推荐人侧功能测试');

    // 5.1 推荐候选人
    console.log('\n5.1 推荐候选人...');
    const referralResult = await apiPost('/api/recruiter/referrals', {
      candidate_name: '推荐测试候选人',
      candidate_phone: '13800000003',
      job_id: jobsList.data?.[0]?.id || 'test',
      referrer_id: referrer.userId,
    });
    console.log(`  推荐结果: ${JSON.stringify(referralResult).substring(0, 300)}`);

    // 5.2 我的推荐
    console.log('\n5.2 我的推荐...');
    const myReferrals = await apiGet(`/api/recruiter/referrals?referrer_id=${referrer.userId}`);
    console.log(`  推荐列表: ${JSON.stringify(myReferrals).substring(0, 200)}`);
  }

  // ===== 6. 权限测试 =====
  console.log('\n' + '='.repeat(60));
  console.log('📋 第六步：权限测试');

  console.log('\n6.1 候选人访问招聘者页面...');
  const perm1 = await apiGet('/api/recruiter/dashboard');
  console.log(`  结果: ${JSON.stringify(perm1).substring(0, 100)}`);

  console.log('\n6.2 候选人访问面试官页面...');
  const perm2 = await apiGet('/api/recruiter/interviewer-tasks');
  console.log(`  结果: ${JSON.stringify(perm2).substring(0, 100)}`);

  // ===== 7. 筛选功能测试 =====
  console.log('\n' + '='.repeat(60));
  console.log('📋 第七步：筛选功能测试');

  // 7.1 省市区筛选
  console.log('\n7.1 省市区筛选...');
  const regionFilter = await apiGet('/api/recruiter/jobs?province=北京&city=北京市&district=朝阳区');
  console.log(`  结果: ${JSON.stringify(regionFilter).substring(0, 200)}`);

  // 7.2 用工类型筛选
  console.log('\n7.2 用工类型筛选...');
  const typeFilter = await apiGet('/api/recruiter/jobs?employment_type=fulltime');
  console.log(`  结果: ${JSON.stringify(typeFilter).substring(0, 200)}`);

  // 7.3 面试状态筛选
  console.log('\n7.3 面试状态筛选...');
  const statusFilter = await apiGet('/api/recruiter/interviews?status=interview-scheduled');
  console.log(`  结果: ${JSON.stringify(statusFilter).substring(0, 200)}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ 测试完成！');
  console.log('='.repeat(60));
}

main().catch(console.error);