<template>
  <div class="about">
    <h1>关于</h1>
    <div class="content">
      <p>这是一个基于Electron的微信机器人客户端，提供以下功能：</p>
      <ul>
        <li>通过HTTP API发送消息</li>
        <li>查看机器人运行状态</li>
        <li>简单的用户界面</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.about {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.content {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
  text-align: left;
}

ul {
  margin-top: 10px;
  padding-left: 20px;
}

li {
  margin: 10px 0;
}
</style> 