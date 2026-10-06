import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { getToken, setToken } from '../src/api/token';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { RequireManager } from '../src/auth/RequireManager';
import { AppShell } from '../src/components/AppShell';
import LoginPage from '../src/pages/LoginPage';
import { fail, mockFetch, newQueryClient, ok } from './helpers';

const MANAGER = { id: 'm1', fullName: 'D. Wijesinghe', role: 'PARK_MANAGER' };
const VILLAGER = { id: 'v1', fullName: 'Nimali Perera', role: 'VILLAGER' };

function renderApp(route = '/') {
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireManager>
                  <AppShell>
                    <p>dashboard</p>
                  </AppShell>
                </RequireManager>
              }
            />
            <Route
              path="/saved"
              element={
                <RequireManager>
                  <p>saved page</p>
                </RequireManager>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function signIn(user, account = 'manager.wijesinghe@wildguard.example') {
  await user.type(screen.getByLabelText('Email'), account);
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('sign in', () => {
  it('sends signed-out visitors to the login page', () => {
    renderApp('/');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('asks for both fields before calling the server', async () => {
    const fetch = mockFetch({});
    const user = userEvent.setup();
    renderApp('/login');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email and password.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('signs a park manager in, stores the token and opens the page they asked for', async () => {
    const fetch = mockFetch({ 'POST /auth/login': ok({ profile: MANAGER, accessToken: 'jwt-1' }) });
    const user = userEvent.setup();
    renderApp('/saved');
    await signIn(user);
    expect(await screen.findByText('saved page')).toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      account: 'manager.wijesinghe@wildguard.example',
      password: 'password123',
    });
  });

  it('shows a friendly message for a wrong password', async () => {
    mockFetch({ 'POST /auth/login': fail(401, 'INVALID_CREDENTIALS') });
    const user = userEvent.setup();
    renderApp('/login');
    await signIn(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
    expect(getToken()).toBeNull();
  });

  it('refuses other roles and does not keep their token', async () => {
    mockFetch({ 'POST /auth/login': ok({ profile: VILLAGER, accessToken: 'jwt-v' }) });
    const user = userEvent.setup();
    renderApp('/login');
    await signIn(user, '0771234812');
    expect(await screen.findByRole('alert')).toHaveTextContent('This dashboard is for park managers');
    expect(getToken()).toBeNull();
  });
});

describe('session', () => {
  it('restores a saved manager session and signs out from the top bar', async () => {
    setToken('jwt-1');
    mockFetch({ 'GET /auth/me': ok(MANAGER) });
    const user = userEvent.setup();
    renderApp('/');
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(screen.getByText('D. Wijesinghe')).toBeInTheDocument();
    expect(screen.getByText('DW')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Generate report' })).toHaveClass('active');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it('drops a saved session that belongs to another role', async () => {
    setToken('jwt-v');
    mockFetch({ 'GET /auth/me': ok(VILLAGER) });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it('drops an expired session', async () => {
    setToken('old');
    mockFetch({ 'GET /auth/me': fail(401, 'UNAUTHENTICATED') });
    renderApp('/');
    await waitFor(() => expect(getToken()).toBeNull());
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('redirects a signed-in manager away from the login page', async () => {
    setToken('jwt-1');
    mockFetch({ 'GET /auth/me': ok(MANAGER) });
    renderApp('/login');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
  });

  it('switches language from the login page', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await user.selectOptions(screen.getByLabelText('Language'), 'ta');
    expect(await screen.findByRole('heading', { name: 'மீண்டும் வருக' })).toBeInTheDocument();
  });

  it('requires the provider', () => {
    function Orphan() {
      useAuth();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow('useAuth must be used inside AuthProvider');
  });
});
