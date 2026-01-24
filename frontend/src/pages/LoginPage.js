import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Coins } from 'lucide-react';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(loginForm.username, loginForm.password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left Side - Image */}
      <div 
        className="hidden md:block relative bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1764795849755-ab58c8fef307?crop=entropy&cs=srgb&fm=jpg&q=85)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 to-background/50 backdrop-blur-sm">
          <div className="flex flex-col justify-center h-full p-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center gold-glow">
                <Coins className="w-7 h-7 text-primary-foreground" />
              </div>
              <h1 className="text-4xl font-serif font-medium text-primary">Kuyumcu</h1>
            </div>
            <h2 className="text-3xl font-serif text-foreground mb-4">Has Altın Yönetim Sistemi</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Kuyumcu, sarraf ve döviz işlemlerinizi tek bir platformdan yönetin.
              Gerçek zamanlı piyasa verileri ile işletmenizi dijitalleştirin.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form Only */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2 md:hidden">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Coins className="w-6 h-6 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-serif font-medium text-primary">Kuyumcu</h1>
              </div>
              <CardTitle className="font-serif">Hoş Geldiniz</CardTitle>
              <CardDescription>
                Kullanıcı adınız ve şifrenizle giriş yapın
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Kullanıcı Adı</Label>
                  <Input
                    id="login-username"
                    data-testid="login-username"
                    type="text"
                    placeholder="kullaniciadi"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Şifre</Label>
                  <Input
                    id="login-password"
                    data-testid="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    autoComplete="current-password"
                  />
                </div>
                {error && (
                  <div className="text-sm text-destructive" data-testid="login-error">
                    {error}
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full gold-glow-hover"
                  disabled={loading}
                  data-testid="login-submit-btn"
                >
                  {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
