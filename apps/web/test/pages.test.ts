import { mountSuspended } from '@nuxt/test-utils/runtime'
import IndexPage from '@web/pages/index.vue'
import { describe, expect, it } from 'vitest'

describe('web landing page', () => {
  it('links login and register to the product app origin', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.get('h1').text()).toBe('Build something great')
    expect(wrapper.get('a[href="http://localhost:3001/login"]').text()).toBe('Login')
    expect(wrapper.get('a[href="http://localhost:3001/register"]').text()).toContain('Get started')
    expect(wrapper.text()).toContain('Start free')
  })
})
