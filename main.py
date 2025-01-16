import json
import sys
from wcferry import Wcf
from datetime import datetime
import logging
import time
from queue import Empty
import os
import threading
from server.message_listener import listen_for_messages
from server.message_sender import send_message

# 获取用户数据目录
app_data = os.getenv('APPDATA')
app_dir = os.path.join(app_data, 'new-boy')
log_dir = os.path.join(app_dir, 'logs')

# 创建日志目录
os.makedirs(log_dir, exist_ok=True)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[
        logging.FileHandler(os.path.join(log_dir, 'robot.log'), encoding='utf-8'),
        logging.StreamHandler(sys.stdout)  # 确保输出到stdout
    ]
)

def handle_command(wcf, command):
    """处理从Electron发来的命令"""
    try:
        cmd = json.loads(command)
        cmd_type = cmd.get('type')
        
        if cmd_type == 'send_message':
            data = cmd.get('data', {})
            recipient = data.get('recipient')
            content = data.get('content')
            at_users = data.get('at_users')
            
            if not recipient or not content:
                response = {
                    'type': 'send_message_response',
                    'success': False,
                    'error': '接收者和消息内容不能为空'
                }
            else:
                success, error = send_message(wcf, recipient, content, at_users)
                response = {
                    'type': 'send_message_response',
                    'success': success,
                    'error': error
                }
            
            # 发送JSON响应
            print(json.dumps(response, ensure_ascii=False))
            sys.stdout.flush()  # 确保立即输出
            
        elif cmd_type == 'get_status':
            status = '已连接' if wcf and wcf.is_login() else '未连接'
            print(f'状态: {status}')
            sys.stdout.flush()
            
        elif cmd_type == 'exit':
            logging.info('收到退出命令')
            if wcf:
                wcf.cleanup()
            sys.exit(0)
            
    except json.JSONDecodeError:
        logging.error('无效的命令格式')
    except Exception as e:
        logging.error(f'处理命令时出错: {str(e)}')

def print_login_info(wcf):
    """打印登录账号信息"""
    logging.info("\n" + "="*50)
    logging.info("登录账号信息：")

    # 获取个人信息
    wxid = wcf.get_self_wxid()
    user_info = wcf.get_user_info()
    logging.info(f"微信号: {wxid}")
    logging.info(f"昵称: {user_info.get('name', '未知')}")
    logging.info(f"备注: {user_info.get('remark', '未知')}")

    # 获取好友数量
    friends = wcf.get_friends()
    logging.info(f"好友数量: {len(friends) if friends else 0}")

    logging.info("="*50 + "\n")

def main():
    try:
        # 初始化 wcferry
        wcf = Wcf()
        
        # 确保微信已登录
        if not wcf.is_login():
            logging.error("请先登录微信")
            return
            
        # 检查消息接收状态
        if not wcf.is_receiving_msg():
            logging.info("启用消息接收功能...")
            wcf.enable_receiving_msg()
            
        # 打印登录信息
        print_login_info(wcf)
        
        # 启动消息监听线程
        listener_thread = threading.Thread(
            target=listen_for_messages,
            args=(wcf,),
            daemon=True  # 设置为守护线程，这样主程序退出时会自动结束
        )
        listener_thread.start()
        logging.info("消息监听线程已启动")
        
        # 主循环：处理标准输入的命令
        while True:
            try:
                # 非阻塞方式读取标准输入
                if sys.stdin.isatty():  # 如果是终端
                    command = input()
                else:  # 如果是管道
                    command = sys.stdin.readline()
                    
                if command:
                    handle_command(wcf, command.strip())
                    
            except EOFError:
                break  # 标准输入已关闭
            except Exception as e:
                logging.error(f"处理输入时出错: {str(e)}")
                continue
                
    except Exception as e:
        logging.error(f"程序启动失败: {str(e)}")
        raise
    finally:
        if 'wcf' in locals():
            wcf.cleanup()

if __name__ == "__main__":
    main()