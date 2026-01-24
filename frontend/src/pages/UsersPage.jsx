import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { UserPlus, Edit, Trash2, Shield, Users as UsersIcon } from 'lucide-react';

const UsersPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'SALES',
  });

  const roles = [
    { value: 'ADMIN', label: 'Admin', icon: Shield },
    { value: 'STORE_MANAGER', label: 'Mağaza Müdürü', icon: UsersIcon },
    { value: 'SALES', label: 'Satış Elemanı', icon: UserPlus },
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Kullanıcılar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        name: user.name,
        role: user.role,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        name: '',
        role: 'SALES',
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      name: '',
      role: 'SALES',
    });
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.username || !formData.email || !formData.name || !formData.role) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error('Şifre zorunludur');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        name: formData.name,
        role: formData.role,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingUser) {
        await api.put(`/api/users/${editingUser.id}`, payload);
        toast.success('Kullanıcı güncellendi');
      } else {
        await api.post('/api/users', payload);
        toast.success('Kullanıcı oluşturuldu');
      }

      handleCloseDialog();
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error.response?.data?.detail || 'Kullanıcı kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId, username) => {
    if (!confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?`)) {
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/api/users/${userId}`);
      toast.success('Kullanıcı silindi');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || 'Kullanıcı silinemedi');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'STORE_MANAGER':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'SALES':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleLabel = (role) => {
    const roleObj = roles.find((r) => r.value === role);
    return roleObj ? roleObj.label : role;
  };

  // Check if user is admin (allow ADMIN and SUPER_ADMIN)
  const userRole = user?.role?.toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  
  if (!isAdmin) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold mb-2">Yetkisiz Erişim</h2>
            <p className="text-muted-foreground">Bu sayfayı görüntülemek için admin yetkisi gereklidir.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kullanıcı Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Sistem kullanıcılarını yönetin</p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={loading}>
          <UserPlus className="w-4 h-4 mr-2" />
          Yeni Kullanıcı
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kullanıcılar ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Henüz kullanıcı bulunmuyor</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Kullanıcı Adı</th>
                    <th className="text-left py-3 px-4 font-semibold">Ad Soyad</th>
                    <th className="text-left py-3 px-4 font-semibold">E-posta</th>
                    <th className="text-left py-3 px-4 font-semibold">Rol</th>
                    <th className="text-left py-3 px-4 font-semibold">Durum</th>
                    <th className="text-right py-3 px-4 font-semibold">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((usr) => (
                    <tr key={usr.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{usr.username}</td>
                      <td className="py-3 px-4">{usr.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{usr.email}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getRoleBadgeColor(usr.role)}`}>
                          {getRoleLabel(usr.role)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {usr.is_active ? (
                          <span className="text-green-600 font-medium">Aktif</span>
                        ) : (
                          <span className="text-red-600 font-medium">Pasif</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(usr)}
                            disabled={loading}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(usr.id, usr.username)}
                            disabled={loading || usr.id === user.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Oluştur'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Kullanıcı Adı *</Label>
              <Input
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="kullanici_adi"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Ad Soyad *</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ad Soyad"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>E-posta *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="ornek@email.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Şifre {editingUser ? '(Değiştirmek için doldur)' : '*'}</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="••••••••"
                required={!editingUser}
              />
            </div>

            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select value={formData.role} onValueChange={(value) => handleChange('role', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={loading}>
                İptal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Kaydediliyor...' : editingUser ? 'Güncelle' : 'Oluştur'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
