/**
 * Titanium Windows Native Module - hyperloop
 *
 * Copyright (c) 2016 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License.
 * Please see the LICENSE included with this distribution for details.
 */

#ifndef _HYPERLOOP_HPP_
#define _HYPERLOOP_HPP_

#include "Hyperloop_EXPORT.h"
#include "Titanium/detail/TiBase.hpp"
#include "Titanium/Module.hpp"

using namespace HAL;

class HYPERLOOP_EXPORT HyperloopBase : public Titanium::Module, public JSExport<HyperloopBase>
{
public:
	HyperloopBase(const JSContext& js_context) TITANIUM_NOEXCEPT;

	virtual ~HyperloopBase() = default;
	HyperloopBase(const HyperloopBase&) = default;
	HyperloopBase& operator=(const HyperloopBase&) = default;
#ifdef TITANIUM_MOVE_CTOR_AND_ASSIGN_DEFAULT_ENABLE
	HyperloopBase(HyperloopBase&&) = default;
	HyperloopBase& operator=(HyperloopBase&&) = default;
#endif

	static void JSExportInitialize();

	virtual HyperloopInvocation::Instance^ get_instance() TITANIUM_NOEXCEPT
	{
		return instance__;
	}

	virtual void set_instance(HyperloopInvocation::Instance^ object) TITANIUM_NOEXCEPT
	{
		instance__ = object;
		if (instance__ != nullptr) {
			type__ = instance__->NativeType;
		}
	}

	virtual void set_type(Windows::UI::Xaml::Interop::TypeName type) TITANIUM_NOEXCEPT
	{
		type__ = type;
	}

protected:
	Windows::UI::Xaml::Interop::TypeName type__;
	HyperloopInvocation::Instance^ instance__{ nullptr };
};

class HYPERLOOP_EXPORT HyperloopFunction : public HyperloopBase, public JSExport<HyperloopFunction>
{
public:
	HyperloopFunction(const JSContext&) TITANIUM_NOEXCEPT;

	virtual ~HyperloopFunction() = default;
	HyperloopFunction(const HyperloopFunction&) = default;
	HyperloopFunction& operator=(const HyperloopFunction&) = default;
#ifdef TITANIUM_MOVE_CTOR_AND_ASSIGN_DEFAULT_ENABLE
	HyperloopFunction(HyperloopFunction&&) = default;
	HyperloopFunction& operator=(HyperloopFunction&&) = default;
#endif

	static void JSExportInitialize();

	JSValue CallAsFunction(const std::vector<JSValue>&, const JSObject& this_object);

	std::string get_functioName() TITANIUM_NOEXCEPT
	{
		return functionName__;
	}

	void set_functionName(const std::string& functionName) TITANIUM_NOEXCEPT
	{
		functionName__ = functionName;
	}

protected:
#pragma warning(push)
#pragma warning(disable : 4251)
	std::string functionName__;
#pragma warning(pop)
};

class HYPERLOOP_EXPORT HyperloopInstance : public HyperloopBase, public JSExport<HyperloopInstance>
{
public:
	HyperloopInstance(const JSContext&) TITANIUM_NOEXCEPT;
	virtual void postCallAsConstructor(const JSContext& js_context, const std::vector<JSValue>& arguments) override;

	bool HasProperty(const JSString& property_name) const;
	JSValue GetProperty(const JSString& property_name) const;

	virtual ~HyperloopInstance() = default;
	HyperloopInstance(const HyperloopInstance&) = default;
	HyperloopInstance& operator=(const HyperloopInstance&) = default;
#ifdef TITANIUM_MOVE_CTOR_AND_ASSIGN_DEFAULT_ENABLE
	HyperloopInstance(HyperloopInstance&&) = default;
	HyperloopInstance& operator=(HyperloopInstance&&) = default;
#endif

	static void JSExportInitialize();
};

class HYPERLOOP_EXPORT HyperloopModule : public Titanium::Module, public JSExport<HyperloopModule>
{
	public:
		HyperloopModule(const JSContext&) TITANIUM_NOEXCEPT;

		virtual ~HyperloopModule()                   = default;
		HyperloopModule(const HyperloopModule&)            = default;
		HyperloopModule& operator=(const HyperloopModule&) = default;
#ifdef TITANIUM_MOVE_CTOR_AND_ASSIGN_DEFAULT_ENABLE
		HyperloopModule(HyperloopModule&&)                 = default;
		HyperloopModule& operator=(HyperloopModule&&)      = default;
#endif

		static void JSExportInitialize();

		static JSValue Convert(const JSContext&, HyperloopInvocation::Instance^);
		static HyperloopInvocation::Instance^ Convert(const JSContext&, const JSValue&, const Windows::UI::Xaml::Interop::TypeName);
		
		TITANIUM_PROPERTY_IMPL_DEF(bool, debug);

		TITANIUM_PROPERTY_DEF(debug);
		TITANIUM_FUNCTION_DEF(exists);
		TITANIUM_FUNCTION_DEF(require);
	private:
		bool debug__{ false };
};
#endif // _HYPERLOOP_HPP_