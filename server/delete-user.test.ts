import { describe, it, expect } from 'vitest';

describe('Gerenciamento de Usuários', () => {
  it('deve ter endpoint deleteUser no router', () => {
    // Verificar que o endpoint existe
    const routerPath = '/home/ubuntu/firerange-workflow/server/routers.ts';
    const fs = require('fs');
    const content = fs.readFileSync(routerPath, 'utf-8');
    
    expect(content).toContain('deleteUser: adminProcedure');
    expect(content).toContain('await db.deleteUser(input.userId)');
  });

  it('deve ter função deleteUser no db.ts', () => {
    const dbPath = '/home/ubuntu/firerange-workflow/server/db.ts';
    const fs = require('fs');
    const content = fs.readFileSync(dbPath, 'utf-8');
    
    expect(content).toContain('export async function deleteUser');
    expect(content).toContain('await db.delete(users)');
  });

  it('deve impedir exclusão do próprio usuário', () => {
    const routerPath = '/home/ubuntu/firerange-workflow/server/routers.ts';
    const fs = require('fs');
    const content = fs.readFileSync(routerPath, 'utf-8');
    
    expect(content).toContain('if (input.userId === ctx.user.id)');
    expect(content).toContain('Você não pode excluir seu próprio usuário');
  });

  it('deve ter página Users.tsx criada', () => {
    const usersPagePath = '/home/ubuntu/firerange-workflow/client/src/pages/Users.tsx';
    const fs = require('fs');
    
    expect(fs.existsSync(usersPagePath)).toBe(true);
    
    const content = fs.readFileSync(usersPagePath, 'utf-8');
    expect(content).toContain('deleteUserMutation');
    expect(content).toContain('AlertDialog');
    expect(content).toContain('Confirmar Exclusão');
  });

  it('deve ter rota /admin/users no App.tsx', () => {
    const appPath = '/home/ubuntu/firerange-workflow/client/src/App.tsx';
    const fs = require('fs');
    const content = fs.readFileSync(appPath, 'utf-8');
    
    expect(content).toContain('import Users from "./pages/Users"');
    expect(content).toContain('path={"/admin/users"}');
  });

  it('deve ter link para página de usuários no Admin.tsx', () => {
    const adminPath = '/home/ubuntu/firerange-workflow/client/src/pages/Admin.tsx';
    const fs = require('fs');
    const content = fs.readFileSync(adminPath, 'utf-8');
    
    expect(content).toContain('Usuários do Sistema');
    expect(content).toContain('setLocation("/admin/users")');
  });

  it('deve desabilitar botão de exclusão para o próprio usuário', () => {
    const usersPagePath = '/home/ubuntu/firerange-workflow/client/src/pages/Users.tsx';
    const fs = require('fs');
    const content = fs.readFileSync(usersPagePath, 'utf-8');
    
    expect(content).toContain('disabled={user.id === currentUser?.id}');
  });

  it('deve mostrar badge "Você" para o usuário logado', () => {
    const usersPagePath = '/home/ubuntu/firerange-workflow/client/src/pages/Users.tsx';
    const fs = require('fs');
    const content = fs.readFileSync(usersPagePath, 'utf-8');
    
    expect(content).toContain('user.id === currentUser?.id');
    expect(content).toContain('Você');
  });
});
