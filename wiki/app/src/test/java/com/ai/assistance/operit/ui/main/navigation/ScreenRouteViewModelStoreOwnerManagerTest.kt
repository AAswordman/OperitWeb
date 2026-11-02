package com.ai.assistance.operit.ui.main.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewModelScope
import com.ai.assistance.operit.ui.main.screens.Screen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/**
 * 路由级 ViewModelStore 管理测试（阶段 4 P1，纯 JVM，无仪器）：
 * - 配置变化不 pop：同一 manager（Activity VM 保留）复用同一 owner/VM；
 * - pop（路由出栈）：remove 触发 onCleared 与 viewModelScope 取消；
 * - 两个 screenKey 互不影响；
 * - replace/clear stack：retainOnly 只保留存活键；
 * - Activity 销毁：clearAll 全清；
 * - 真实导航栈（AppRouterState push/pop/resetTo）驱动的 alive 键与清理；
 * - AppContent 首次组合（attach）只同步一次（LaunchedEffect(Unit)）：pop 后
 *   转场完成前不得清理仍渲染的离页 owner，只在转场完成分支 retainOnly 后清理。
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ScreenRouteViewModelStoreOwnerManagerTest {

    @Before
    fun setUp() {
        // viewModelScope 使用 Main.immediate；Unconfined 保证取消回调同步执行
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /** 记录 onCleared 与 viewModelScope 取消的跟踪 VM（须可被 ViewModelProvider 反射实例化）。 */
    class TrackableViewModel : ViewModel() {
        var onClearedCalled = false
        var scopeCancelled = false

        init {
            viewModelScope.launch {
                try {
                    awaitCancellation()
                } finally {
                    scopeCancelled = true
                }
            }
        }

        override fun onCleared() {
            onClearedCalled = true
        }
    }

    private fun trackableVM(owner: ViewModelStoreOwner): TrackableViewModel =
        ViewModelProvider(owner)[TrackableViewModel::class.java]

    private fun awaitScopeCancelled(vm: TrackableViewModel) {
        val deadline = System.currentTimeMillis() + 5_000
        while (!vm.scopeCancelled) {
            if (System.currentTimeMillis() > deadline) {
                fail("timed out waiting for viewModelScope cancellation")
            }
            Thread.sleep(10)
        }
    }

    // ==== 配置变化：不 pop 复用同 owner/VM ====

    @Test
    fun configurationChange_withoutPop_reusesSameOwnerAndViewModel() {
        val manager = ScreenRouteViewModelStoreOwnerManager()

        val ownerFirst = manager.ownerFor("stats-key")
        val vmFirst = trackableVM(ownerFirst)

        // 模拟配置变化：同一 manager 实例（Activity VM 保留），同 screenKey → 同 owner
        val ownerSecond = manager.ownerFor("stats-key")
        assertSame(ownerFirst, ownerSecond)
        // 同 owner → 同 store → 同 VM 实例
        assertSame(vmFirst, trackableVM(ownerSecond))

        assertFalse(vmFirst.onClearedCalled)
        assertFalse(vmFirst.scopeCancelled)
    }

    // ==== pop：remove → onCleared + viewModelScope 取消 ====

    @Test
    fun pop_removeOwner_clearsViewModelAndCancelsScope() {
        val manager = ScreenRouteViewModelStoreOwnerManager()
        val owner = manager.ownerFor("stats-key")
        val vm = trackableVM(owner)

        manager.remove("stats-key")

        assertTrue(vm.onClearedCalled)
        awaitScopeCancelled(vm)

        // 再次进入同路由：新 owner + 新 VM（旧 store 已清理）
        val newOwner = manager.ownerFor("stats-key")
        assertNotSame(owner, newOwner)
        assertNotSame(vm, trackableVM(newOwner))
    }

    @Test
    fun remove_unknownKey_isNoOp() {
        val manager = ScreenRouteViewModelStoreOwnerManager()
        val vm = trackableVM(manager.ownerFor("stats-key"))

        manager.remove("no-such-key")

        assertFalse(vm.onClearedCalled)
        assertFalse(vm.scopeCancelled)
    }

    // ==== 两个 screenKey 互不影响 ====

    @Test
    fun twoKeys_areIndependent() {
        val manager = ScreenRouteViewModelStoreOwnerManager()
        val vmStats = trackableVM(manager.ownerFor("stats-key"))
        val vmOther = trackableVM(manager.ownerFor("other-key"))

        manager.remove("stats-key")

        assertTrue(vmStats.onClearedCalled)
        awaitScopeCancelled(vmStats)
        assertFalse(vmOther.onClearedCalled)
        assertFalse(vmOther.scopeCancelled)
    }

    // ==== replace / clear stack：retainOnly ====

    @Test
    fun retainOnly_removesNonAliveKeys_keepsAliveKeys() {
        val manager = ScreenRouteViewModelStoreOwnerManager()
        val vmStats = trackableVM(manager.ownerFor("stats-key"))
        val vmHome = trackableVM(manager.ownerFor("home-key"))

        // 抽屉导航 resetTo：栈只剩 home
        manager.retainOnly(setOf("home-key"))

        assertTrue(vmStats.onClearedCalled)
        awaitScopeCancelled(vmStats)
        assertFalse(vmHome.onClearedCalled)
        assertFalse(vmHome.scopeCancelled)
    }

    // ==== Activity 销毁：clearAll 全清 ====

    @Test
    fun clearAll_clearsEveryOwner() {
        val manager = ScreenRouteViewModelStoreOwnerManager()
        val vmA = trackableVM(manager.ownerFor("key-a"))
        val vmB = trackableVM(manager.ownerFor("key-b"))

        manager.clearAll()

        assertTrue(vmA.onClearedCalled)
        assertTrue(vmB.onClearedCalled)
        awaitScopeCancelled(vmA)
        awaitScopeCancelled(vmB)

        // 全清后同键再进：新 owner（旧实例不再复用）
        assertNotSame(vmA, trackableVM(manager.ownerFor("key-a")))
    }

    // ==== 真实导航栈驱动（AppRouterState push/pop/resetTo）====

    private val resolveScreen: (RouteEntry) -> Screen? = { entry ->
        when (entry.routeId) {
            "home" -> Screen.AiChat
            "settings" -> Screen.AiChat
            "stats" -> Screen.AiChat
            "other" -> Screen.AiChat
            else -> null
        }
    }

    @Test
    fun realNavigationStack_drivesRouteViewModelCleanup() {
        val manager = ScreenRouteViewModelStoreOwnerManager()
        val router = AppRouterState(RouteEntry(routeId = "home"))
        // 模拟 AppContent 转场完成时的同步调用
        fun syncAlive() = manager.retainOnly(screenKeysAliveOnStack(router.backStack, resolveScreen))

        val homeKey = routeScreenKey(router.currentEntry, resolveScreen)!!
        val homeVm = trackableVM(manager.ownerFor(homeKey))
        syncAlive()
        assertFalse(homeVm.onClearedCalled)

        // 推入 stats（Settings → TokenUsageStatistics）
        router.navigate(routeId = "stats")
        val statsKey = routeScreenKey(router.currentEntry, resolveScreen)!!
        val statsVm = trackableVM(manager.ownerFor(statsKey))
        syncAlive()
        assertFalse(homeVm.onClearedCalled)
        assertFalse(statsVm.onClearedCalled)

        // pop（返回）：stats 离开栈 → 清理（离页查询不再保留）
        router.pop()
        syncAlive()
        assertTrue(statsVm.onClearedCalled)
        awaitScopeCancelled(statsVm)
        assertFalse(homeVm.onClearedCalled)

        // 再次进入 stats：新路由实例 → 新 screenKey → 新 owner/VM
        router.navigate(routeId = "stats")
        val statsKey2 = routeScreenKey(router.currentEntry, resolveScreen)!!
        assertNotEquals(statsKey, statsKey2)
        val statsVm2 = trackableVM(manager.ownerFor(statsKey2))
        assertNotSame(statsVm, statsVm2)

        // resetTo（replace/clear stack，如抽屉导航）：旧栈全部清理
        router.resetTo(RouteEntry(routeId = "home"))
        syncAlive()
        assertTrue(statsVm2.onClearedCalled)
        awaitScopeCancelled(statsVm2)
        assertTrue(homeVm.onClearedCalled)
        // 新 home 实例存活
        val newHomeKey = routeScreenKey(router.currentEntry, resolveScreen)!!
        val newHomeVm = trackableVM(manager.ownerFor(newHomeKey))
        assertFalse(newHomeVm.onClearedCalled)
    }

    // ==== keepAlive 路由：stableScreenKey 复用 ====

    @Test
    fun keepAliveRoute_usesStableScreenKeyAndReusesOwner() {
        val manager = ScreenRouteViewModelStoreOwnerManager()
        val resolveKeepAlive: (RouteEntry) -> Screen? = {
            Screen.ToolPkgComposeDsl(
                containerPackageName = "pkg",
                uiModuleId = "mod",
                title = "t",
                keepAlive = true,
            )
        }

        val entry1 = RouteEntry(routeId = "toolpkg")
        val key1 = routeScreenKey(entry1, resolveKeepAlive)!!
        assertEquals("toolpkg_keepalive:pkg:mod", key1)
        val vm = trackableVM(manager.ownerFor(key1))

        // 同 routeId 再次进入：stableScreenKey 相同 → 复用同一 owner/VM
        val entry2 = RouteEntry(routeId = "toolpkg")
        val key2 = routeScreenKey(entry2, resolveKeepAlive)!!
        assertEquals(key1, key2)
        assertSame(vm, trackableVM(manager.ownerFor(key2)))
        assertFalse(vm.onClearedCalled)
    }

    // ==== AppContent 重建（配置变化/跨 600dp）：attach 同步 = alive + current ====
    // attach 同步只在首次组合执行一次（LaunchedEffect(Unit)）：pop 后 alive
    // 立即更新，但退出动画未完成、离页仍在渲染，不得触发 retainOnly；
    // 清理只发生在模拟的转场完成分支 retainOnly(aliveRouteKeys()) 之后。

    @Test
    fun retainedRouteKeysOnContentAttach_unionsCurrentWithAliveAndDeduplicates() {
        // 当前页不在 alive 中：并入 alive
        assertEquals(
            setOf("stats-a", "other", "stats-b", "current"),
            retainedRouteKeysOnContentAttach(
                currentScreenKey = "current",
                aliveScreenKeys = setOf("stats-a", "other", "stats-b")
            )
        )
        // 当前页已在 alive 中：不重复，结果不变
        assertEquals(
            setOf("stats-a", "other"),
            retainedRouteKeysOnContentAttach(
                currentScreenKey = "stats-a",
                aliveScreenKeys = setOf("stats-a", "other")
            )
        )
        // alive 为空（栈解析未就绪）时仍保留当前页
        assertEquals(
            setOf("current"),
            retainedRouteKeysOnContentAttach(currentScreenKey = "current", aliveScreenKeys = emptySet())
        )
    }

    @Test
    fun appContentRecreation_attachSyncOnce_preservesFullStack_popClearsOnlyAfterTransitionCompleted() {
        val manager = ScreenRouteViewModelStoreOwnerManager()
        val router = AppRouterState(RouteEntry(routeId = "home"))
        // 模拟 AppContent 首次组合（attach）时的单次同步：alive + 当前键
        // （对应 LaunchedEffect(Unit)：只在组合进入时执行，不随导航变化重启）
        fun attachSync() {
            manager.retainOnly(
                retainedRouteKeysOnContentAttach(
                    currentScreenKey = routeScreenKey(router.currentEntry, resolveScreen)!!,
                    aliveScreenKeys = screenKeysAliveOnStack(router.backStack, resolveScreen)
                )
            )
        }
        // 模拟 AppContent 转场完成分支的清理：alive = 导航栈 + keepAlive 缓存 +
        // 当前键；本测试路由均非 keepAlive，缓存部分为空
        fun transitionCleanup() {
            manager.retainOnly(
                screenKeysAliveOnStack(router.backStack, resolveScreen) +
                    routeScreenKey(router.currentEntry, resolveScreen)!!
            )
        }

        // 两个不同 TokenStats 路由实例（中间夹 other）同栈：
        // 跨 600dp 重建前旧组合已访问过 backStack [home, statsA, other, statsB]
        router.navigate(routeId = "stats")
        router.navigate(routeId = "other")
        router.navigate(routeId = "stats")
        val homeKey = routeScreenKey(router.backStack[0], resolveScreen)!!
        val statsAKey = routeScreenKey(router.backStack[1], resolveScreen)!!
        val otherKey = routeScreenKey(router.backStack[2], resolveScreen)!!
        val statsBKey = routeScreenKey(router.backStack[3], resolveScreen)!!

        // 重建前旧组合已为这些路由创建 owner/VM（manager 是 Activity 级，跨重建保留）
        val vmHome = trackableVM(manager.ownerFor(homeKey))
        val vmStatsA = trackableVM(manager.ownerFor(statsAKey))
        val vmOther = trackableVM(manager.ownerFor(otherKey))
        val vmStatsB = trackableVM(manager.ownerFor(statsBKey))

        // 首次组合 attach 只同步一次：保留 alive + 当前键 → 全部存活
        // （回归：旧逻辑只保留当前键会误清 backStack 其他 opt-in owner）
        attachSync()
        assertFalse(vmHome.onClearedCalled)
        assertFalse(vmStatsA.onClearedCalled)
        assertFalse(vmOther.onClearedCalled)
        assertFalse(vmStatsB.onClearedCalled)

        // pop statsB：alive 已更新但退出动画未完成，不得调用 retainOnly →
        // statsB 仍在渲染，owner/VM 必须存活（P1 回归：attach 若按 alive
        // 变化重启会在此立即清理 statsB）
        router.pop()
        assertFalse(vmStatsB.onClearedCalled)
        assertFalse(vmStatsB.scopeCancelled)
        assertFalse(vmHome.onClearedCalled)
        assertFalse(vmStatsA.onClearedCalled)
        assertFalse(vmOther.onClearedCalled)

        // 调用转场完成清理后：仅 statsB 清理，其余存活
        transitionCleanup()
        assertTrue(vmStatsB.onClearedCalled)
        awaitScopeCancelled(vmStatsB)
        assertFalse(vmHome.onClearedCalled)
        assertFalse(vmStatsA.onClearedCalled)
        assertFalse(vmOther.onClearedCalled)

        // pop other：转场完成前不清理，转场完成后才清理
        router.pop()
        assertFalse(vmOther.onClearedCalled)
        assertFalse(vmOther.scopeCancelled)
        transitionCleanup()
        assertTrue(vmOther.onClearedCalled)
        awaitScopeCancelled(vmOther)
        assertFalse(vmHome.onClearedCalled)
        assertFalse(vmStatsA.onClearedCalled)

        // pop statsA：逐次同前，home 始终存活
        router.pop()
        assertFalse(vmStatsA.onClearedCalled)
        assertFalse(vmStatsA.scopeCancelled)
        transitionCleanup()
        assertTrue(vmStatsA.onClearedCalled)
        awaitScopeCancelled(vmStatsA)
        assertFalse(vmHome.onClearedCalled)
        assertFalse(vmHome.scopeCancelled)
    }

    @Test
    fun layoutSwitch_newAppContentAttach_usesNewAliveKeys() {
        val manager = ScreenRouteViewModelStoreOwnerManager()
        val router = AppRouterState(RouteEntry(routeId = "home"))
        router.navigate(routeId = "stats")
        val homeKey = routeScreenKey(router.backStack[0], resolveScreen)!!
        val statsKey = routeScreenKey(router.backStack[1], resolveScreen)!!
        val vmHome = trackableVM(manager.ownerFor(homeKey))
        val vmStats = trackableVM(manager.ownerFor(statsKey))

        // 旧组合（如 Phone 布局）attach：保留 [home, stats] + 当前键
        manager.retainOnly(retainedRouteKeysOnContentAttach(statsKey, setOf(homeKey, statsKey)))
        assertFalse(vmHome.onClearedCalled)
        assertFalse(vmStats.onClearedCalled)

        // pop stats 后转场未完成时发生 Phone → Tablet 切换：旧 AppContent
        // 销毁，新 AppContent attach 重新执行（LaunchedEffect(Unit)）并使用
        // 新传入的 alive（pop 后的栈 [home] + 当前键）。stats 在新组合中不再
        // 渲染（screenCache/keepAlive 缓存已重置），attach 同步即清理其 owner。
        router.pop()
        manager.retainOnly(
            retainedRouteKeysOnContentAttach(
                currentScreenKey = routeScreenKey(router.currentEntry, resolveScreen)!!,
                aliveScreenKeys = screenKeysAliveOnStack(router.backStack, resolveScreen)
            )
        )
        assertTrue(vmStats.onClearedCalled)
        awaitScopeCancelled(vmStats)
        assertFalse(vmHome.onClearedCalled)
        assertFalse(vmHome.scopeCancelled)
    }
}
